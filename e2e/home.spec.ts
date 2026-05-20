import { test, expect } from '@playwright/test'

test.describe('Home page', () => {
  test('renders main sections', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/blueSky/i)
    await expect(page.locator('text=@blueSky').first()).toBeVisible()
    await expect(page.getByRole('heading', { level: 2 }).filter({ hasText: /カレンダー|予約状況/ })).toBeVisible({ timeout: 10_000 })
    await expect(page.getByRole('heading', { level: 2 }).filter({ hasText: /クチコミ/ })).toBeVisible()
  })
})
