import { test, expect } from '@playwright/test'
import { randomBytes } from 'node:crypto'

test.use({ trace: 'off', screenshot: 'off', video: 'off' })
test('empty database cannot be claimed through public first-register', async ({ request, page }) => {
  test.skip(process.env.CMS_PHASE !== 'bootstrap', 'Only run by the isolated local verifier before CLI bootstrap')
  await page.goto('/admin')
  await expect(page.locator('input[name="email"]')).toBeVisible()
  const response = await request.post('/api/users/first-register', { data: { email: 'intruder@example.test', password: randomBytes(24).toString('hex') } })
  expect(response.status()).toBe(403)
})
