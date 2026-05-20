import { test, expect } from '@playwright/test'

test.describe('Reservation flow', () => {
  test('reserve page loads', async ({ page }) => {
    await page.goto('/reserve')
    await expect(page).toHaveURL(/\/reserve/)
    // Page renders a step indicator / form — check for body presence
    await expect(page.locator('main, body').first()).toBeVisible()
    // Should not show a 404 / error
    await expect(page.locator('text=404')).toHaveCount(0)
  })

  test('reserve page accepts date param without errors', async ({ page }) => {
    const resp = await page.goto('/reserve?date=2027-01-15')
    expect(resp?.status()).toBeLessThan(400)
    await expect(page).toHaveURL(/date=2027-01-15/)
  })
})
