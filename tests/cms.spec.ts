import { test, expect } from '@playwright/test'
import { randomBytes } from 'node:crypto'
import sharp from 'sharp'

// Disable traces/screenshots: browser and request contexts handle generated credentials.
test.use({ actionTimeout: 15000, trace: 'off', screenshot: 'off', video: 'off' })
test('CMS editing, authorization, media and restart persistence', async ({ page, request }, testInfo) => {
  test.skip(process.env.CMS_SMOKE !== '1' || testInfo.project.name !== 'desktop', 'Run npm run verify:local for an isolated database and generated credentials')
  test.setTimeout(180000)
  const email = process.env.ADMIN_EMAIL!
  const password = process.env.ADMIN_PASSWORD!
  const restart = process.env.CMS_PHASE === 'restart'
  await page.goto('/admin/login')
  await page.locator('input[name="email"]').fill(email)
  await page.locator('input[name="password"]').fill(password)
  await page.getByRole('button', { name: /^log\s?in$/i }).click()
  await expect(page.getByRole('link', { name: 'Pages', exact: true }).first()).toBeVisible()
  console.log('Browser admin login passed')
  const admin = page.request
  if (restart) {
    for (const collection of ['pages', 'posts']) {
      const response = await request.get(`/api/${collection}?where[slug][equals]=mission-${collection}`)
      expect(response.ok()).toBe(true)
      expect((await response.json()).docs[0].title).toBe(`Mission ${collection}`)
    }
    const media = (await (await request.get('/api/media?where[alt][equals]=Mission image')).json()).docs[0]
    expect(media.objectKey).toBe(`${process.env.MEDIA_PREFIX}/${media.filename}`)
    const restoredImage = await request.get(media.url)
    expect(restoredImage.ok()).toBe(true)
    expect((await sharp(await restoredImage.body()).metadata()).width).toBe(800)
    const restoredPost = (await (await request.get('/api/posts?where[slug][equals]=mission-posts')).json()).docs[0]
    expect(restoredPost.featuredImage.id).toBe(media.id)
    expect((await (await request.get('/api/globals/site-settings')).json()).websiteName).toBe('Mission Site')
    await page.goto('/content/posts/mission-posts')
    await expect(page.getByRole('heading', { name: 'Mission posts' })).toBeVisible()
    return
  }
  const richText = { root: { type: 'root', children: [{ type: 'paragraph', version: 1, children: [{ type: 'text', text: 'Persisted mission content.', format: 0, detail: 0, mode: 'normal', style: '', version: 1 }], direction: 'ltr', format: '', indent: 0 }], direction: 'ltr', format: '', indent: 0, version: 1 } }
  // Exercise the actual admin form and Lexical editor for page creation.
  await page.goto('/admin/collections/pages/create')
  console.log('Page create form opened')
  await page.locator('#field-title').fill('Mission pages')
  await page.locator('#field-slug').fill('mission-pages')
  await page.locator('[contenteditable="true"]').first().fill('Persisted mission content.')
  console.log('Page fields filled')
  await page.getByRole('button', { name: 'Publish changes', exact: true }).click()
  await expect.poll(async () => (await (await request.get('/api/pages?where[slug][equals]=mission-pages')).json()).totalDocs).toBe(1)

  console.log('Page published through the browser and readable anonymously')
  const image = await sharp({ create: { width: 800, height: 600, channels: 3, background: '#c96e36' } }).png().toBuffer()
  // Use Payload's media form for a real multipart upload.
  await page.goto('/admin/collections/media/create')
  await page.locator('input[type="file"]').setInputFiles({ name: 'mission.png', mimeType: 'image/png', buffer: image })
  await page.locator('#field-alt').fill('Mission image')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect.poll(async () => (await (await admin.get('/api/media?where[alt][equals]=Mission image')).json()).totalDocs).toBe(1)
  const media = (await (await admin.get('/api/media?where[alt][equals]=Mission image')).json()).docs[0]
  expect(media.width).toBe(800)
  expect(media.height).toBe(600)
  expect(media.sizes.thumbnail.width).toBe(400)
  expect((await request.get(media.url)).ok()).toBe(false)
  expect((await request.get(media.sizes.thumbnail.url)).ok()).toBe(false)
  const publishImage = await admin.patch(`/api/media/${media.id}`, { data: { visibility: 'public', prefix: 'attacker', objectKey: 'attacker', _objectKey: 'attacker' } })
  expect(publishImage.ok()).toBe(true)
  const publicMedia = (await publishImage.json()).doc
  expect(publicMedia.objectKey).toBe(`${process.env.MEDIA_PREFIX}/${media.filename}`)
  expect(publicMedia._objectKey).toBeNull()
  expect((await request.get(media.url)).ok()).toBe(true)
  const thumbnailRead = await request.get(media.sizes.thumbnail.url)
  expect(thumbnailRead.ok()).toBe(true)
  expect((await sharp(await thumbnailRead.body()).metadata()).width).toBe(400)

  expect((await request.patch(`/api/media/${media.id}`, { data: { visibility: 'public' } })).ok()).toBe(false)
  expect((await request.delete(`/api/media/${media.id}`)).ok()).toBe(false)
  console.log('Image upload, variant metadata, private/public delivery and key protection passed')
  const post = await admin.post('/api/posts', { data: { title: 'Mission posts', slug: 'mission-posts', excerpt: 'A persisted post.', content: richText, featuredImage: media.id, _status: 'published', publishedAt: new Date().toISOString(), seoTitle: 'Mission SEO' } })
  expect(post.status()).toBe(201)
  await page.goto(`/admin/collections/posts/${(await post.json()).doc.id}`)
  await expect(page.locator('#field-title')).toHaveValue('Mission posts')
  await expect(page.getByText(media.filename, { exact: true }).first()).toBeVisible()
  const relatedPost = (await (await request.get('/api/posts?where[slug][equals]=mission-posts')).json()).docs[0]
  expect(relatedPost.featuredImage.id).toBe(media.id)
  await expect(page.getByRole('img', { name: 'Mission image', exact: true })).toBeVisible()
  for (const collection of ['pages', 'posts']) {
    const draft = await admin.post(`/api/${collection}`, { data: { title: 'Hidden draft', slug: `hidden-${collection}`, content: richText, _status: 'draft' } })
    expect(draft.status()).toBe(201)
    const id = (await draft.json()).doc.id
    expect((await request.get(`/api/${collection}/${id}`)).ok()).toBe(false)
    expect((await (await request.get(`/api/${collection}?draft=true&where[slug][equals]=hidden-${collection}`)).json()).totalDocs).toBe(0)
    expect((await request.get(`/api/${collection}/versions`)).ok()).toBe(false)
    expect((await request.post(`/api/${collection}`, { data: { title: 'Unauthorized' } })).ok()).toBe(false)
    expect((await request.patch(`/api/${collection}/${id}`, { data: { title: 'Unauthorized' } })).ok()).toBe(false)
    expect((await request.delete(`/api/${collection}/${id}`)).ok()).toBe(false)
    expect((await request.get(`/content/${collection}/hidden-${collection}`)).status()).toBe(404)
  }
  const graphqlResponse = await request.post('/api/graphql', { data: { query: '{ Pages { docs { title _status } } Posts { docs { title _status } } }' } })
  const graphql = await graphqlResponse.json()
  expect(graphql.errors).toBeUndefined()
  expect(graphql.data.Pages.docs.every((doc: { _status: string }) => doc._status === 'published')).toBe(true)
  expect(graphql.data.Posts.docs.every((doc: { _status: string }) => doc._status === 'published')).toBe(true)
  expect((await request.post('/api/users', { data: { email: 'stranger@example.test', password: randomBytes(24).toString('hex'), role: 'admin' } })).ok()).toBe(false)
  expect((await request.post('/api/users/first-register', { data: { email: 'stranger@example.test', password: randomBytes(24).toString('hex') } })).ok()).toBe(false)
  expect((await request.get('/api/users')).ok()).toBe(false)
  expect((await request.post('/api/media', { multipart: { file: { name: 'no.png', mimeType: 'image/png', buffer: image }, _payload: JSON.stringify({ alt: 'Unauthorized' }) } })).ok()).toBe(false)
  for (const file of [{ name: 'bad.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg/>') }, { name: 'large.png', mimeType: 'image/png', buffer: Buffer.alloc(3 * 1024 * 1024 + 1) }]) {
    expect((await admin.post('/api/media', { multipart: { file, _payload: JSON.stringify({ alt: 'Rejected' }) } })).ok()).toBe(false)
  }
  expect((await request.post('/api/globals/site-settings', { data: { websiteName: 'Unauthorized' } })).ok()).toBe(false)
  expect((await admin.post('/api/globals/site-settings', { data: { websiteName: 'Mission Site', websiteDescription: 'SQLite persistence verified', logo: media.id } })).ok()).toBe(true)

  console.log('Content, GraphQL, draft isolation, denied writes, upload limits and settings checks passed')
  const editorPassword = randomBytes(24).toString('base64url')
  const editorResult = await admin.post('/api/users', { data: { email: 'editor@example.test', password: editorPassword, role: 'editor' } })
  expect(editorResult.status()).toBe(201)
  const editorID = (await editorResult.json()).doc.id
  const login = await request.post('/api/users/login', { data: { email: 'editor@example.test', password: editorPassword } })
  expect(login.ok()).toBe(true)
  expect((await request.patch(`/api/users/${editorID}`, { data: { role: 'admin' } })).ok()).toBe(false)
  expect((await request.post('/api/users', { data: { email: 'other@example.test', password: editorPassword, role: 'admin' } })).ok()).toBe(false)
  expect((await request.post('/api/pages', { data: { title: 'Editor draft', slug: 'editor-draft', content: richText, _status: 'draft' } })).status()).toBe(201)
  console.log('Editor can create content and cannot promote itself or create users')
  await page.goto('/content/posts/mission-posts')
  await expect(page.getByRole('heading', { name: 'Mission posts' })).toBeVisible()
})
