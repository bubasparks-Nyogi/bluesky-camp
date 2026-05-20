import { test, expect } from '@playwright/test'

test.describe('Reservation flow', () => {
  test('reserve page loads with step 1 (date selection)', async ({ page }) => {
    await page.goto('/reserve')
    await expect(page).toHaveURL(/\/reserve/)
    await expect(page.locator('input[type="date"]').first()).toBeVisible({ timeout: 10_000 })
  })

  test('reserve page accepts date param and skips to step 2', async ({ page }) => {
    await page.goto('/reserve?date=2027-01-15')
    const dateInputs = page.locator('input[type="date"]')
    await expect(dateInputs.first()).toHaveValue('2027-01-15', { timeout: 10_000 })
  })
})
