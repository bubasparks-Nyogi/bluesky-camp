import { test, expect } from '@playwright/test'

test.describe('News page', () => {
  test('news list loads', async ({ page }) => {
    await page.goto('/news')
    await expect(page).toHaveTitle(/お知らせ/)
    await expect(page.getByRole('heading', { level: 1 }).filter({ hasText: /お知らせ/ })).toBeVisible()
  })

  test('category filter buttons render', async ({ page }) => {
    await page.goto('/news')
    await expect(page.getByRole('link', { name: 'すべて' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'お知らせ' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'イベント' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'ブログ' })).toBeVisible()
  })
})
