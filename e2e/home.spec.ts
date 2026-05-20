import { test, expect } from '@playwright/test'

test.describe('Home page', () => {
  test('renders main sections', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/blueSky/i)
    await expect(page.locator('text=@blueSky').first()).toBeVisible()
    // Verify multiple major sections render (calendar has no heading; check other sections)
    await expect(page.getByRole('heading', { level: 2 }).filter({ hasText: 'アクセス' })).toBeVisible({ timeout: 10_000 })
    await expect(page.getByRole('heading', { level: 2 }).filter({ hasText: 'クチコミ' })).toBeVisible()
  })
})
