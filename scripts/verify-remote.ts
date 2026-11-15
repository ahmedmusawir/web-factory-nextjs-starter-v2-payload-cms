import './load-env'
import assert from 'node:assert/strict'
import { randomBytes, randomUUID, createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { spawn, spawnSync, type ChildProcess } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'
import { chromium, request, expect, type Browser, type BrowserContext, type APIRequestContext } from '@playwright/test'
import { createClient } from '@libsql/client'
import { S3Client, ListObjectsV2Command, GetObjectCommand } from '@aws-sdk/client-s3'
import sharp from 'sharp'
import { readEnvironment } from '../cms/environment'

// Deliberately limited to the Director-approved disposable resources. Never runs migrations.
assert.ok(process.argv.includes('--approved-live-poc'), 'Explicit --approved-live-poc is required')
const env = readEnvironment()
const host = new URL(env.url).hostname
assert.ok(env.appEnv === 'test' && env.kind === 'turso' && env.storage === 'r2', 'Remote test mode required')
assert.ok(/^web-factory-v2-poc-db(?:-[a-z0-9-]+)?\.(?:[a-z0-9-]+\.)?turso\.io$/.test(host), 'Unapproved database')
for (const name of ['DATABASE_TARGET_HOST', 'MIGRATION_TARGET_HOST', 'BOOTSTRAP_TARGET_HOST']) assert.ok(process.env[name] === host, 'Database target guards must match')
assert.ok(env.r2?.bucket === 'stark-web-factory-poc-media', 'Unapproved bucket')
const r2 = env.r2!
const db = createClient({ url: env.url, authToken: process.env.DATABASE_AUTH_TOKEN })
const s3 = new S3Client({ region: 'auto', endpoint: r2.endpoint, forcePathStyle: true, credentials: { accessKeyId: r2.accessKeyId, secretAccessKey: r2.secretAccessKey } })
const runID = randomUUID()
const evidenceDir = `evidence/live-integration/${runID}`
mkdirSync(evidenceDir, { recursive: true })
const email = `live-${runID}@example.test`
const password = randomBytes(32).toString('base64url')
const childEnv = { ...process.env, ADMIN_EMAIL: email, ADMIN_PASSWORD: password }
const baseURL = 'http://127.0.0.1:3001'
const report: Record<string, unknown> = { runID, started: new Date().toISOString(), database: 'web-factory-v2-poc-db', bucket: r2.bucket, credentialsArchived: false }
const stages: string[] = []
let stage = 'read-only safety checks'
let server: ChildProcess | undefined
let browser: Browser | undefined
let context: BrowserContext | undefined
let anonymous: APIRequestContext | undefined
let admin: APIRequestContext | undefined
let adminID: number | undefined
let bootstrapCreated = false
const owned: { collection: string; id: number }[] = []
let originalSettings: Record<string, unknown> | undefined
let settingsChanged = false
const mediaFilesBefore = existsSync('.data/test/media') ? readdirSync('.data/test/media').sort() : []
function record(name: string) { stages.push(name); console.log(`PASS: ${name}`) }
function writeReport() { writeFileSync(`${evidenceDir}/results.json`, JSON.stringify({ ...report, stages }, null, 2) + '\n') }
async function query(input: Parameters<typeof db.execute>[0]) {
  assert.match(typeof input === 'string' ? input : input.sql, /^SELECT\b/i, 'Only read-only SQL may retry')
  for (let attempt = 0; ; attempt++) {
    try { return await db.execute(input) } catch (error) {
      if (attempt === 2) throw error
      report.readOnlyRetries = Number(report.readOnlyRetries || 0) + 1
      await delay(1000 * (attempt + 1))
    }
  }
}
async function count(table: string) { return Number((await query(`SELECT COUNT(*) AS n FROM ${table}`)).rows[0].n) }
async function listObjects() { return s3.send(new ListObjectsV2Command({ Bucket: r2.bucket, Prefix: env.prefix + '/', MaxKeys: 1000 })) }
async function stopServer() {
  if (server?.pid && server.exitCode === null && server.signalCode === null) {
    process.kill(-server.pid, 'SIGTERM')
    await Promise.race([new Promise<void>(resolve => server!.once('exit', () => resolve())), delay(5000)])
    if (server.exitCode === null && server.signalCode === null) { process.kill(-server.pid, 'SIGKILL'); await delay(500) }
  }
  server = undefined
}
async function startServer() {
  const probe = createServer()
  await new Promise<void>((resolve, reject) => { probe.once('error', reject); probe.listen(3001, '127.0.0.1', () => probe.close(() => resolve())) })
  // Discard raw application output: error objects can contain request credentials.
  server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '-p', '3001'], { env: process.env, detached: true, stdio: 'ignore' })
  for (let attempt = 0; attempt < 60; attempt++) {
    if (server.exitCode !== null) throw new Error('Task-owned server exited before readiness')
    try { if ((await fetch(baseURL, { signal: AbortSignal.timeout(2000) })).ok) return } catch { /* bounded readiness polling */ }
    await delay(500)
  }
  throw new Error('Task-owned loopback server did not start')
}
async function loginBrowser() {
  context = await browser!.newContext({ baseURL })
  await context.route('**/*', route => {
    const url = new URL(route.request().url())
    return url.origin === baseURL || (url.origin === r2.publicURL && route.request().method() === 'GET') ? route.continue() : route.abort()
  })
  const page = await context.newPage()
  page.setDefaultTimeout(30000)
  await page.goto('/admin/login')
  await page.locator('input[name="email"]').fill(email)
  await page.locator('input[name="password"]').fill(password)
  await page.getByRole('button', { name: /^log\s?in$/i }).click()
  await expect(page.getByRole('link', { name: 'Pages', exact: true }).first()).toBeVisible()
  admin = context.request
  return page
}
async function verifyImage(media: { objectKey: string; url: string; filename: string; sizes: { thumbnail: { filename: string; url: string } } }) {
  const checks = []
  for (const [key, url, width] of [[media.objectKey, media.url, 800], [`${env.prefix}/${media.sizes.thumbnail.filename}`, media.sizes.thumbnail.url, 400]] as const) {
    assert.ok(new URL(url).origin === r2.publicURL && !url.includes(r2.endpoint), 'Delivery URL must use the public origin')
    const object = await s3.send(new GetObjectCommand({ Bucket: r2.bucket, Key: key }))
    const bytes = Buffer.from(await object.Body!.transformToByteArray())
    assert.equal((await sharp(bytes).metadata()).width, width)
    const response = await fetch(url, { signal: AbortSignal.timeout(30000), redirect: 'error' })
    assert.equal(response.status, 200, 'Public development delivery must succeed')
    const delivered = Buffer.from(await response.arrayBuffer())
    assert.equal(createHash('sha256').update(delivered).digest('hex'), createHash('sha256').update(bytes).digest('hex'))
    checks.push({ key, width, bytes: bytes.length, publicStatus: response.status, sha256: createHash('sha256').update(bytes).digest('hex') })
  }
  return checks
}
try {
  const migration = await query('SELECT name FROM payload_migrations')
  assert.deepEqual(migration.rows.map(row => row.name), ['20261114_040213_foundation'], 'Only the reviewed initial migration is allowed')
  for (const table of ['users', 'pages', 'posts', 'media']) assert.equal(await count(table), 0, 'Existing content prevents automatic test bootstrap')
  const before = await listObjects()
  assert.equal(before.KeyCount || 0, 0, 'Test prefix must be empty; no existing object may be touched')
  record('approved targets and empty POC content verified')
  stage = 'loopback admin and public bootstrap denial'
  await startServer()
  anonymous = await request.newContext({ baseURL, timeout: 60000 })
  assert.equal((await anonymous.post('/api/users/first-register', { data: { email, password } })).status(), 403)
  assert.equal(await count('users'), 0)
  record('public first-register denied on empty remote database')
  stage = 'secure CLI bootstrap'
  const bootstrap = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/create-admin.ts'], { env: childEnv, stdio: 'ignore', timeout: 60000 })
  assert.equal(bootstrap.status, 0, 'CLI bootstrap must succeed')
  bootstrapCreated = true
  adminID = Number((await query({ sql: 'SELECT id FROM users WHERE email = ?', args: [email] })).rows[0].id)
  record('CLI admin bootstrap with memory-only random credentials')
  stage = 'Chromium admin login and page creation'
  browser = await chromium.launch({ headless: true })
  const page = await loginBrowser()
  const pageSlug = `live-page-${runID}`
  await page.goto('/admin/collections/pages/create')
  await page.locator('#field-title').fill('Live POC page')
  await page.locator('#field-slug').fill(pageSlug)
  await page.locator('[contenteditable="true"]').first().fill('Disposable remote persistence proof.')
  await page.getByRole('button', { name: 'Publish changes', exact: true }).click()
  await expect.poll(async () => (await (await anonymous!.get(`/api/pages?where[slug][equals]=${pageSlug}`)).json()).totalDocs, { timeout: 30000 }).toBe(1)
  const pageDoc = (await (await anonymous.get(`/api/pages?where[slug][equals]=${pageSlug}`)).json()).docs[0]
  owned.push({ collection: 'pages', id: pageDoc.id })
  assert.ok((await admin!.patch(`/api/pages/${pageDoc.id}`, { data: { seoTitle: 'Updated live POC SEO' } })).ok())
  record('Chromium page creation and publication; authenticated update')
  const image = await sharp({ create: { width: 800, height: 600, channels: 3, background: '#9367c9' } }).png().toBuffer()
  stage = 'R2 private upload rejection'
  const privateUpload = await admin!.post('/api/media', { multipart: { file: { name: 'private.png', mimeType: 'image/png', buffer: image }, _payload: JSON.stringify({ alt: 'Rejected private fixture', visibility: 'private' }) } })
  assert.equal(privateUpload.status(), 400)
  assert.equal(await count('media'), 0)
  assert.equal((await listObjects()).KeyCount || 0, 0)
  record('private upload rejected before any R2 object or media record')
  stage = 'Chromium public R2 upload'
  await page.goto('/admin/collections/media/create')
  await page.locator('input[type="file"]').setInputFiles({ name: 'live-poc.png', mimeType: 'image/png', buffer: image })
  const alt = `Live image ${runID}`
  await page.locator('#field-alt').fill(alt)
  await page.locator('#field-visibility').click()
  await page.getByText('public', { exact: true }).last().click()
  const savedResponse = page.waitForResponse(response => new URL(response.url()).pathname === '/api/media' && response.request().method() === 'POST', { timeout: 60000 })
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  const saved = await savedResponse
  report.mediaUploadHTTPStatus = saved.status()
  assert.equal(saved.status(), 201, 'Wait for the completed Payload upload response, not just the visible DB record')
  await expect.poll(async () => (await (await admin!.get(`/api/media?where[alt][equals]=${encodeURIComponent(alt)}`)).json()).totalDocs, { timeout: 45000 }).toBe(1)
  const media = (await (await admin!.get(`/api/media?where[alt][equals]=${encodeURIComponent(alt)}`)).json()).docs[0]
  owned.push({ collection: 'media', id: media.id })
  assert.equal(media.objectKey, `${env.prefix}/${media.filename}`)
  report.mediaObjectMetadata = { objectKey: media.objectKey, filename: media.filename, storedPrefix: media.prefix, internalObjectKey: media._objectKey, thumbnailFilename: media.sizes.thumbnail.filename }
  report.mediaObjectsAfterUpload = (await listObjects()).Contents?.map(object => ({ key: object.Key, bytes: object.Size })) || []
  report.images = await verifyImage(media)
  const metadata = (await query({ sql: 'SELECT id,object_key,filename,mime_type,width,height,sizes_thumbnail_filename FROM media WHERE id = ?', args: [media.id] })).rows[0]
  assert.equal(metadata.object_key, media.objectKey)
  assert.equal(metadata.width, 800)
  report.tursoMediaMetadata = metadata
  assert.deepEqual(existsSync('.data/test/media') ? readdirSync('.data/test/media').sort() : [], mediaFilesBefore)
  record('Chromium R2 upload, original/thumbnail objects, public byte delivery, Turso metadata; no local bytes')
  stage = 'post, settings and authorization CRUD'
  const content = pageDoc.content
  const createdPost = await admin!.post('/api/posts', { data: { title: 'Live POC post', slug: `live-post-${runID}`, excerpt: 'Disposable test.', content, featuredImage: media.id, publishedAt: new Date().toISOString(), _status: 'published' } })
  assert.equal(createdPost.status(), 201)
  const post = (await createdPost.json()).doc
  owned.push({ collection: 'posts', id: post.id })
  for (const collection of ['pages', 'posts']) {
    const draft = await admin!.post(`/api/${collection}`, { data: { title: 'Private draft fixture', slug: `live-draft-${collection}-${runID}`, content, _status: 'draft' } })
    assert.equal(draft.status(), 201)
    const doc = (await draft.json()).doc
    owned.push({ collection, id: doc.id })
    assert.ok(!(await anonymous.get(`/api/${collection}/${doc.id}`)).ok())
    assert.equal((await (await anonymous.get(`/api/${collection}?draft=true&where[id][equals]=${doc.id}`)).json()).totalDocs, 0)
    assert.ok(!(await anonymous.post(`/api/${collection}`, { data: { title: 'Denied' } })).ok())
    assert.ok(!(await anonymous.patch(`/api/${collection}/${doc.id}`, { data: { title: 'Denied' } })).ok())
    assert.ok(!(await anonymous.delete(`/api/${collection}/${doc.id}`)).ok())
  }
  assert.ok(!(await anonymous.get('/api/users')).ok())
  assert.ok(!(await anonymous.post('/api/media', { multipart: { file: { name: 'denied.png', mimeType: 'image/png', buffer: image }, _payload: JSON.stringify({ alt: 'Denied', visibility: 'public' }) } })).ok())
  assert.ok(!(await anonymous.delete(`/api/media/${media.id}`)).ok())
  assert.equal((await admin!.patch(`/api/media/${media.id}`, { data: { visibility: 'private' } })).status(), 400)
  originalSettings = await (await admin!.get('/api/globals/site-settings')).json()
  assert.ok(!(await anonymous.post('/api/globals/site-settings', { data: { websiteName: 'Denied' } })).ok())
  assert.ok((await admin!.post('/api/globals/site-settings', { data: { websiteName: `Live POC ${runID}`, websiteDescription: 'Remote restart proof', logo: media.id } })).ok())
  settingsChanged = true
  await page.goto(`/admin/collections/posts/${post.id}`)
  await expect(page.locator('#field-title')).toHaveValue('Live POC post')
  await expect(page.getByRole('img', { name: alt, exact: true })).toBeVisible()
  record('posts, drafts, settings, media relationships and unauthorized write/read denial')
  report.preRestartCounts = Object.fromEntries(await Promise.all(['users','pages','posts','media','site_settings'].map(async table => [table, await count(table)])))
  stage = 'fresh application process restart'
  await context!.close()
  await stopServer()
  await startServer()
  const restartedPage = await loginBrowser()
  const persistedPost = (await (await anonymous.get(`/api/posts/${post.id}`)).json())
  assert.equal(persistedPost.featuredImage.id, media.id)
  assert.equal((await (await anonymous.get(`/api/pages/${pageDoc.id}`)).json()).seoTitle, 'Updated live POC SEO')
  assert.equal((await (await anonymous.get('/api/globals/site-settings')).json()).websiteName, `Live POC ${runID}`)
  report.imagesAfterRestart = await verifyImage(media)
  await restartedPage.goto(`/content/posts/live-post-${runID}`)
  await expect(restartedPage.getByRole('heading', { name: 'Live POC post' })).toBeVisible()
  record('fresh-process browser login, content, settings, relationship and R2 bytes persisted')
  report.integration = 'PASS'
} catch (error) {
  report.integration = 'FAIL'
  report.failedStage = stage
  // Never serialize raw errors, request objects, headers, browser state or credentials.
  report.errorType = error instanceof Error ? error.name : 'UnknownError'
  let summary = error instanceof Error ? error.message.split('\n')[0] : 'Unknown failure'
  for (const secret of [email, password, env.secret, process.env.DATABASE_AUTH_TOKEN, r2.accessKeyId, r2.secretAccessKey]) if (secret) summary = summary.split(secret).join('[REDACTED]')
  report.errorSummary = summary.slice(0, 300)
  console.log(`FAIL: ${stage}; details limited to error type ${report.errorType}`)
  process.exitCode = 1
} finally {
  stage = 'authorized cleanup of owned fixtures'
  try {
    if (bootstrapCreated) {
      if (!server) await startServer()
      await anonymous?.dispose()
      anonymous = await request.newContext({ baseURL, timeout: 60000 })
      const cleanupLogin = await anonymous.post('/api/users/login', { data: { email, password } })
      assert.ok(cleanupLogin.ok(), 'Authenticate as this run’s administrator for cleanup')
      const cleanupUser = (await cleanupLogin.json()).user
      assert.ok(cleanupUser.email === email && cleanupUser.role === 'admin', 'Cleanup identity must match this run')
      if (adminID !== undefined) assert.equal(cleanupUser.id, adminID)
      adminID = cleanupUser.id
      admin = anonymous
    }
    if (admin) {
      if (settingsChanged && originalSettings) assert.ok((await admin.post('/api/globals/site-settings', { data: { websiteName: originalSettings.websiteName, websiteDescription: originalSettings.websiteDescription ?? null, logo: originalSettings.logo ?? null } })).ok())
      // Discover only this run's uniquely marked records if a UI assertion failed after a save.
      for (const collection of ['pages', 'posts', 'media']) {
        const condition = collection === 'media' ? `where[alt][equals]=${encodeURIComponent(`Live image ${runID}`)}` : `where[slug][contains]=${runID}`
        const response = await admin.get(`/api/${collection}?${condition}&limit=100`)
        assert.ok(response.ok())
        for (const doc of (await response.json()).docs) if (!owned.some(item => item.collection === collection && item.id === doc.id)) owned.push({ collection, id: doc.id })
      }
      for (const collection of ['posts', 'pages', 'media']) for (const item of owned.filter(item => item.collection === collection)) assert.ok((await admin.delete(`/api/${collection}/${item.id}`)).ok(), 'Owned fixture deletion must succeed')
      assert.equal((await listObjects()).KeyCount || 0, 0, 'R2 prefix must return to its initial empty state')
      for (const item of owned) assert.equal(Number((await query({ sql: `SELECT COUNT(*) AS n FROM ${item.collection} WHERE id = ?`, args: [item.id] })).rows[0].n), 0)
      assert.ok(adminID, 'Cleanup must identify the generated administrator')
      assert.ok((await admin.delete(`/api/users/${adminID}`)).ok(), 'Delete only the generated test administrator')
      assert.equal(await count('users'), 0, 'Temporary administrator must actually be removed')
      report.cleanup = 'PASS'
      report.finalCounts = Object.fromEntries(await Promise.all(['users','users_sessions','pages','_pages_v','posts','_posts_v','media','site_settings','payload_migrations'].map(async table => [table, await count(table)])))
      record('owned content, images, R2 objects and temporary administrator removed; settings restored')
    } else report.cleanup = bootstrapCreated ? 'BLOCKED' : 'No fixtures created'
  } catch (error) {
    report.cleanup = 'FAIL'
    report.cleanupErrorType = error instanceof Error ? error.name : 'UnknownError'
    process.exitCode = 1
    console.log('FAIL: owned-fixture cleanup; retained IDs are recorded without credentials')
  }
  report.ownedFixtureIDs = owned
  report.finished = new Date().toISOString()
  writeReport()
  await context?.close().catch(() => {})
  await browser?.close()
  await anonymous?.dispose()
  await stopServer()
  db.close(); s3.destroy()
}
