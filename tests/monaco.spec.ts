import { test, expect } from '@playwright/test'
import { writeFileSync } from 'node:fs'

test.use({ actionTimeout: 15000, trace: 'off', screenshot: 'off', video: 'off' })
test('characterize Monaco loading without contacting external hosts', async ({ page }, info) => {
  test.skip(process.env.CMS_SMOKE !== '1' || info.project.name !== 'desktop' || process.env.CMS_PHASE === 'restart')
  const blocked: string[] = []
  await page.route('**/*', route => {
    const url = new URL(route.request().url())
    if (url.protocol.startsWith('http') && url.hostname !== '127.0.0.1') {
      blocked.push(`${url.origin}${url.pathname}`)
      return route.abort()
    }
    return route.continue()
  })
  await page.goto('/admin/login')
  await page.locator('input[name="email"]').fill(process.env.ADMIN_EMAIL!)
  await page.locator('input[name="password"]').fill(process.env.ADMIN_PASSWORD!)
  await page.getByRole('button', { name: 'Login', exact: true }).click()
  await expect(page.getByRole('link', { name: 'Pages', exact: true }).first()).toBeVisible()
  await page.goto('/admin/collections/pages/create')
  await expect(page.locator('#field-title')).toBeVisible()
  await page.goto('/admin/collections/media/create')
  await expect(page.locator('#field-alt')).toBeVisible()
  const normal = [...blocked]
  expect(normal.some(url => /monaco|jsdelivr/.test(url))).toBe(false)
  // Hidden is a navigation setting, not proof that a collection's admin route is inaccessible.
  await page.goto('/admin/collections/payload-preferences/create')
  await page.waitForTimeout(2000) // Bounded observation of the lazy editor, with outbound requests blocked.
  const hiddenRoute = { url: page.url(), editorElements: await page.locator('.code-editor').count(), headings: await page.getByRole('heading').allTextContents() }
  writeFileSync(`${process.env.ENGINEERING_EVIDENCE_DIR || 'evidence/mission-002/local-regression'}/monaco-browser.json`, JSON.stringify({ normalWorkflowExternalRequests: normal, hiddenPreferencesExternalRequestsBlocked: blocked.slice(normal.length), externalNetworkAllowed: false, hiddenRoute, monacoLoadAttempted: blocked.some(url => /monaco/.test(url)), finding: 'Authenticated hidden preferences route observed; any external requests intercepted. This is reachability evidence, not an exploit test.' }, null, 2) + '\n')
})
