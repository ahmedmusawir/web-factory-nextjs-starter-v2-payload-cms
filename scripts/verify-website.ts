import './load-env'
import assert from 'node:assert/strict'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { spawn, spawnSync, type ChildProcess } from 'node:child_process'
import { createServer } from 'node:net'
import { setTimeout as delay } from 'node:timers/promises'
import { chromium, request, expect, type Browser, type BrowserContext, type APIRequestContext, type Page as BrowserPage } from '@playwright/test'
import { createClient } from '@libsql/client'
import { S3Client, GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3'
import sharp from 'sharp'
import { readEnvironment } from '../cms/environment'
import { websiteStructure } from '../content/website'
import type { Page, Media } from '../payload-types'

assert.ok(process.argv.includes('--approved-live-poc'), 'Explicit approved POC flag required')
const env = readEnvironment(), host = new URL(env.url).hostname
assert.ok(env.kind === 'turso' && env.storage === 'r2' && env.appEnv === 'test' && /^web-factory-v2-poc-db-.*\.turso\.io$/.test(host))
assert.equal(env.r2?.bucket, 'stark-web-factory-poc-media')
for (const key of ['DATABASE_TARGET_HOST', 'MIGRATION_TARGET_HOST', 'BOOTSTRAP_TARGET_HOST']) assert.equal(process.env[key], host)
const r2 = env.r2!, prefix = `${env.prefix}/web-factory-poc-site-1/`
const db = createClient({ url: env.url, authToken: process.env.DATABASE_AUTH_TOKEN })
const s3 = new S3Client({ region: 'auto', endpoint: r2.endpoint, forcePathStyle: true, credentials: { accessKeyId: r2.accessKeyId, secretAccessKey: r2.secretAccessKey } })
const runID = randomUUID(), directory = `evidence/mission-002/live-${runID}`
mkdirSync(directory, { recursive: true })
const email = `mission002-${runID}@example.test`, password = randomBytes(32).toString('base64url')
const baseURL = 'http://127.0.0.1:3001', referenceURL = 'http://127.0.0.1:3002'
const report: Record<string, unknown> = { runID, database: 'web-factory-v2-poc-db', bucket: r2.bucket, prefix, credentialsArchived: false }
const stages: string[] = []
let stage = 'preflight', target: ChildProcess | undefined, reference: ChildProcess | undefined
let browser: Browser | undefined, context: BrowserContext | undefined, admin: APIRequestContext | undefined, anonymous: APIRequestContext | undefined
let adminID: number | undefined, original: Page | undefined, media: Media | undefined, originalBytes: Buffer | undefined
let headingChanged = false, imageChanged = false, bootstrapCreated = false
const draftHeading = `Mission 002 editable heading ${runID.slice(0, 8)}`
const record = (name: string) => { stages.push(name); console.log(`PASS: ${name}`) }
const sha = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex')
async function start(port: number, cwd = process.cwd()) {
  const probe = createServer()
  await new Promise<void>((resolve, reject) => { probe.once('error', reject); probe.listen(port, '127.0.0.1', () => probe.close(() => resolve())) })
  const processHandle = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '-p', String(port)], { cwd, env: process.env, detached: true, stdio: 'ignore' })
  for (let i = 0; i < 80; i++) {
    assert.equal(processHandle.exitCode, null, 'Server exited during readiness')
    try { if ((await fetch(`http://127.0.0.1:${port}`, { signal: AbortSignal.timeout(3000) })).ok) return processHandle } catch { /* bounded loopback readiness */ }
    await delay(500)
  }
  process.kill(-processHandle.pid!, 'SIGTERM'); throw new Error('Server readiness failed')
}
async function stop(child?: ChildProcess) {
  if (child?.pid && child.exitCode === null && child.signalCode === null) {
    process.kill(-child.pid, 'SIGTERM')
    await Promise.race([new Promise<void>(resolve => child.once('exit', () => resolve())), delay(5000)])
    if (child.exitCode === null && child.signalCode === null) process.kill(-child.pid, 'SIGKILL')
  }
}
async function login() {
  context = await browser!.newContext({ baseURL })
  await context.route('**/*', route => {
    const url = new URL(route.request().url())
    return url.origin === baseURL || (url.origin === r2.publicURL && route.request().method() === 'GET') ? route.continue() : route.abort()
  })
  const page = await context.newPage(); page.setDefaultTimeout(30000)
  await page.goto('/admin/login')
  await page.locator('input[name="email"]').fill(email); await page.locator('input[name="password"]').fill(password)
  await page.getByRole('button', { name: /^log\s?in$/i }).click()
  await expect(page.getByRole('link', { name: 'Pages', exact: true }).first()).toBeVisible()
  admin = context.request
  return page
}
async function settle(page: BrowserPage) {
  await page.evaluate(() => document.fonts.ready)
  await page.locator('img').evaluateAll(imgs => Promise.all(imgs.map(img => (img as HTMLImageElement).decode())))
  await page.emulateMedia({ reducedMotion: 'reduce' })
}
async function home(): Promise<Page> { return (await (await anonymous!.get('/api/pages?where[slug][equals]=home&depth=2')).json()).docs[0] }
async function verifyImage(doc: Media) {
  const checks = []
  for (const [key, url] of [[doc.objectKey!, doc.url!], [`${doc.prefix}/${doc.sizes!.thumbnail!.filename}`, doc.sizes!.thumbnail!.url!]]) {
    assert.ok(key.startsWith(prefix)); assert.equal(new URL(url).origin, r2.publicURL)
    const object = await s3.send(new GetObjectCommand({ Bucket: r2.bucket, Key: key }), { abortSignal: AbortSignal.timeout(30000) })
    const bytes = Buffer.from(await object.Body!.transformToByteArray())
    const response = await fetch(url, { signal: AbortSignal.timeout(30000), redirect: 'error' })
    assert.equal(response.status, 200); assert.equal(sha(Buffer.from(await response.arrayBuffer())), sha(bytes))
    checks.push({ key, bytes: bytes.length, sha256: sha(bytes), publicStatus: response.status })
  }
  return checks
}
async function restore() {
  if (!admin) return
  if (headingChanged && original) {
    const current = (await (await admin.get(`/api/pages/${original.id}?draft=true&depth=0`)).json()) as Page
    assert.equal(current.sections?.[0].heroHeading, draftHeading, 'Concurrent editorial change: do not overwrite')
    const sections = original.sections!.map(row => ({ ...row, ...(row.imgSrc1 && typeof row.imgSrc1 === 'object' ? { imgSrc1: row.imgSrc1.id } : {}) }))
    assert.ok((await admin.patch(`/api/pages/${original.id}`, { data: { sections, _status: 'published' } })).ok(), 'Restore original page')
    headingChanged = false
  }
  if (imageChanged && media && originalBytes) {
    const result = await admin.patch(`/api/media/${media.id}`, { multipart: { file: { name: 'restored-reference.png', mimeType: 'image/png', buffer: originalBytes }, _payload: JSON.stringify({ alt: media.alt, visibility: 'public' }) } })
    assert.ok(result.ok(), 'Restore original image bytes'); imageChanged = false
    const restored = (await result.json()).doc as Media
    report.restoredImage = await verifyImage(restored)
  }
}
try {
  assert.equal(Number((await db.execute('SELECT COUNT(*) AS n FROM users')).rows[0].n), 0, 'Existing users prevent temporary bootstrap')
  assert.deepEqual((await db.execute('SELECT name FROM payload_migrations ORDER BY id')).rows.map(row => row.name), ['20261114_040213_foundation', '20261114_072417_website'])
  assert.equal(Number((await db.execute("SELECT COUNT(*) AS n FROM pages WHERE source_i_d LIKE 'web-factory-poc-site-1:page:%'")).rows[0].n), 7)
  record('approved targets and seven imported pages in Turso')
  stage = 'production servers and R2 delivery'
  target = await start(3001); reference = await start(3002, '/tmp/stark-mission002-reference-site')
  anonymous = await request.newContext({ baseURL, timeout: 60000 })
  original = await home(); media = original.sections![0].imgSrc1 as Media
  originalBytes = Buffer.from(await (await fetch(media.url!)).arrayBuffer())
  const allMedia = (await (await anonymous.get('/api/media?limit=100&where[sourceID][contains]=web-factory-poc-site-1:media:')).json()).docs as Media[]
  assert.equal(allMedia.length, 12)
  report.media = []
  for (const doc of allMedia) {
    assert.ok(doc.alt); (report.media as unknown[]).push({ id: doc.id, checks: await verifyImage(doc) })
    console.log(`Verified R2 media ${(report.media as unknown[]).length}/12`)
  }
  record('12 media records and 24 original/thumbnail R2 objects deliver matching image bytes')
  stage = 'desktop and mobile reference comparison'
  browser = await chromium.launch({ headless: true })
  const comparisons: unknown[] = []
  for (const [device, width, height] of [['desktop', 1440, 900], ['mobile', 375, 812]] as const) {
    const visual = await browser.newContext({ viewport: { width, height }, isMobile: device === 'mobile', hasTouch: device === 'mobile' })
    const referencePage = await visual.newPage(), targetPage = await visual.newPage()
    for (const entry of websiteStructure.pages) {
      const snapshots = []
      for (const [label, page, origin] of [['reference', referencePage, referenceURL], ['target', targetPage, baseURL]] as const) {
        assert.equal((await page.goto(origin + entry.route))!.status(), 200); await settle(page)
        assert.equal(await page.locator('h1').count(), 1)
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
        snapshots.push(await page.evaluate(() => ({ text: document.body.innerText, title: document.title, description: document.querySelector('meta[name="description"]')?.getAttribute('content'), headings: [...document.querySelectorAll('h1,h2,h3')].map(e => e.textContent), sections: [...document.querySelectorAll('main > section')].map(e => ({ id: e.id, top: e.getBoundingClientRect().top, height: e.getBoundingClientRect().height })), font: getComputedStyle(document.body).fontFamily })))
        await page.screenshot({ path: `${directory}/${device}-${entry.slug}-${label}.png`, fullPage: true, animations: 'disabled' })
      }
      writeFileSync(`${directory}/${device}-${entry.slug}-comparison.json`, JSON.stringify(snapshots, null, 2) + '\n')
      assert.equal(snapshots[0].text, snapshots[1].text, `Editorial text mismatch: ${entry.slug}`)
      assert.equal(snapshots[0].title, snapshots[1].title); assert.equal(snapshots[0].description, snapshots[1].description)
      assert.deepEqual(snapshots[0].sections, snapshots[1].sections, `Layout mismatch: ${entry.slug}`)
      const left = await sharp(`${directory}/${device}-${entry.slug}-reference.png`).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
      const right = await sharp(`${directory}/${device}-${entry.slug}-target.png`).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
      assert.deepEqual(left.info, right.info)
      let changed = 0
      for (let offset = 0; offset < left.data.length; offset += 4) if ([0, 1, 2].some(channel => Math.abs(left.data[offset + channel] - right.data[offset + channel]) > 20)) changed++
      comparisons.push({ device, route: entry.route, exactTextAndSectionGeometry: true, width: left.info.width, height: left.info.height, changedPixelPercentOver20: Number((100 * changed / (left.info.width * left.info.height)).toFixed(3)) })
      console.log(`Compared ${device} ${entry.route}`)
    }
    await targetPage.goto(baseURL + '/website-design/')
    if (device === 'mobile') await targetPage.locator('.mobile-toggle').click()
    const services = targetPage.getByRole('button', { name: /Services/ })
    await services.click(); await expect(services).toHaveAttribute('aria-expanded', 'true')
    await targetPage.keyboard.press('Escape'); await expect(services).toBeFocused()
    await targetPage.locator('main details summary').first().click()
    await expect(targetPage.locator('main details').first()).toHaveAttribute('open', '')
    await targetPage.locator('footer a[href="/contact/"]').first().click()
    await expect(targetPage).toHaveURL(/\/contact\/?$/)
    assert.equal((await targetPage.goto(baseURL + '/missing-page/'))!.status(), 404)
    await visual.close()
  }
  report.comparisons = comparisons; record('seven reference routes compared at desktop and mobile, text/SEO/geometry match')
  stage = 'secure bootstrap and browser login'
  const bootstrap = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/create-admin.ts'], { env: { ...process.env, ADMIN_EMAIL: email, ADMIN_PASSWORD: password }, stdio: 'ignore', timeout: 60000 })
  assert.equal(bootstrap.status, 0); bootstrapCreated = true
  adminID = Number((await db.execute({ sql: 'SELECT id FROM users WHERE email=?', args: [email] })).rows[0].id)
  let page = await login(); record('secure CLI bootstrap and real Chromium admin login')
  stage = 'browser draft save'
  await page.goto(`/admin/collections/pages/${original.id}`)
  await page.getByRole('button', { name: 'Show All', exact: true }).click()
  await page.locator('#field-sections__0__heroHeading').fill(draftHeading)
  const saved = page.waitForResponse(res => res.request().method() === 'PATCH' && new URL(res.url()).pathname === `/api/pages/${original!.id}`)
  await page.getByRole('button', { name: 'Save Draft', exact: true }).click()
  assert.ok((await saved).ok()); headingChanged = true
  assert.equal((await home()).sections![0].heroHeading, original.sections![0].heroHeading)
  assert.equal((await anonymous.get('/preview/home')).status(), 404)
  const draftAPI = await anonymous.get(`/api/pages/${original.id}?draft=true`)
  assert.ok(!(await draftAPI.text()).includes(draftHeading), 'Anonymous REST must not expose latest draft')
  await page.goto('/preview/home'); await expect(page.locator('h1')).toContainText(draftHeading)
  const publicPage = await browser.newPage(); await publicPage.goto(baseURL); await expect(publicPage.locator('h1')).not.toContainText(draftHeading)
  await publicPage.screenshot({ path: `${directory}/draft-public-unchanged.png`, fullPage: true })
  await page.screenshot({ path: `${directory}/authorized-preview.png`, fullPage: true })
  record('browser Save Draft, anonymous draft denial, authorized preview, public page unchanged')
  stage = 'browser publication'
  await page.goto(`/admin/collections/pages/${original.id}`)
  await page.getByRole('button', { name: 'Publish changes', exact: true }).click()
  await expect.poll(async () => (await home()).sections![0].heroHeading, { timeout: 30000 }).toBe(draftHeading)
  await publicPage.reload(); await expect(publicPage.locator('h1')).toContainText(draftHeading)
  await publicPage.screenshot({ path: `${directory}/published-heading.png`, fullPage: true })
  record('browser publication appears on the next public request without rebuild')
  stage = 'idempotent import preserves editor changes'
  const imported = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/import-website.ts'], { env: { ...process.env, ENGINEERING_EVIDENCE_DIR: directory }, stdio: 'pipe', timeout: 120000 })
  assert.equal(imported.status, 0); assert.equal((await home()).sections![0].heroHeading, draftHeading)
  record('rerun import preserves editor heading and existing records')
  stage = 'browser media file replacement'
  await page.goto(`/admin/collections/media/${media.id}`)
  await page.locator('.file-details__remove').click()
  const replacement = await sharp({ create: { width: 1200, height: 640, channels: 3, background: '#ef8015' } }).png().toBuffer()
  await page.locator('input[type="file"]').setInputFiles({ name: 'mission002-replacement.png', mimeType: 'image/png', buffer: replacement })
  const imageSaved = page.waitForResponse(res => res.request().method() === 'PATCH' && new URL(res.url()).pathname === `/api/media/${media!.id}`)
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  assert.ok((await imageSaved).ok()); imageChanged = true
  const newMedia = (await home()).sections![0].imgSrc1 as Media
  assert.equal(newMedia.id, media.id); assert.notEqual(newMedia.objectKey, media.objectKey)
  report.replacement = await verifyImage(newMedia)
  await publicPage.reload(); await expect(publicPage.locator('.agency-scene img')).toHaveAttribute('src', newMedia.url!)
  await settle(publicPage); await publicPage.screenshot({ path: `${directory}/replaced-image.png`, fullPage: true })
  record('browser image replacement preserves relationship and dedicated prefix; public R2 bytes change')
  stage = 'fresh-process restart'
  await context!.close(); context = undefined; admin = undefined
  await stop(target); target = await start(3001)
  await publicPage.reload(); await expect(publicPage.locator('h1')).toContainText(draftHeading)
  await expect(publicPage.locator('.agency-scene img')).toHaveAttribute('src', newMedia.url!)
  page = await login(); assert.equal((await home()).sections![0].heroHeading, draftHeading)
  await verifyImage((await home()).sections![0].imgSrc1 as Media)
  assert.equal((await (await anonymous.get('/api/globals/site-settings')).json()).sourceID, 'web-factory-poc-site-1:settings')
  record('heading, media relationship, R2 bytes, settings and login survive fresh-server restart')
  stage = 'unauthorized writes'
  const denied: { method: string; resource: string; status: number }[] = []
  report.deniedWrites = denied
  for (const url of [`/api/pages/${original.id}`, `/api/media/${media.id}`]) {
    const response = await anonymous.patch(url, { data: { title: 'Denied', alt: 'Denied', websiteName: 'Denied' } })
    denied.push({ method: 'PATCH', resource: url, status: response.status() })
    assert.ok([401, 403].includes(response.status()), 'Anonymous write must fail')
  }
  const settingsWrite = await anonymous.post('/api/globals/site-settings', { data: { websiteName: 'Denied' } })
  denied.push({ method: 'POST', resource: '/api/globals/site-settings', status: settingsWrite.status() })
  assert.ok([401, 403].includes(settingsWrite.status()), 'Anonymous global update must fail')
  assert.ok([401, 403].includes((await anonymous.delete(`/api/media/${media.id}`)).status()))
  record('anonymous page/media/settings writes and media deletion denied')
  stage = 'restore reference content'
  await restore(); assert.equal((await home()).sections![0].heroHeading, original.sections![0].heroHeading)
  const objects = await s3.send(new ListObjectsV2Command({ Bucket: r2.bucket, Prefix: prefix }))
  assert.equal(objects.KeyCount, 24, 'Replacement cleanup must not leave orphan objects')
  report.objectCount = objects.KeyCount
  record('original heading and image restored; exactly 24 website objects remain')
  report.status = 'PASS'
} catch (error) {
  report.status = 'FAIL'; report.failedStage = stage; report.errorType = error instanceof Error ? error.name : 'Unknown'
  // Never serialize request contexts, credentials, response headers, or raw error objects.
  console.error(`FAIL: ${stage}`); process.exitCode = 1
} finally {
  try {
    if (bootstrapCreated && !admin && target && browser) await login()
    await restore()
    if (bootstrapCreated) {
      assert.ok(admin && adminID, 'Temporary administrator needs cleanup')
      assert.equal(Number((await db.execute({ sql: 'SELECT id FROM users WHERE email=?', args: [email] })).rows[0]?.id), adminID)
      assert.ok((await admin.delete(`/api/users/${adminID}`)).ok())
      record('temporary administrator removed; imported website retained')
    }
  } catch { report.cleanup = 'FAIL — review temporary account or editorial restoration'; process.exitCode = 1 }
  await browser?.close(); await anonymous?.dispose(); await stop(target); await stop(reference)
  db.close(); s3.destroy()
  writeFileSync(`${directory}/results.json`, JSON.stringify({ ...report, stages }, null, 2) + '\n')
  console.log(`Evidence: ${directory}/results.json`)
}
