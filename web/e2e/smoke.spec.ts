import { expect, test } from '@playwright/test'

test('home page loads benchmark data', async ({ page }) => {
  const testDataResponsePromise = page.waitForResponse((res) => res.url().endsWith('/test-data.json'))

  await page.goto('/')

  const testDataResponse = await testDataResponsePromise
  expect(testDataResponse.ok()).toBeTruthy()

  await expect(page.locator('#total-results')).not.toHaveText('-')
  await expect(page.locator('#results-body')).not.toContainText('Loading...')
  await expect(page.locator('#results-body')).not.toContainText('No results found')
  expect(await page.locator('#results-body tr').count()).toBeGreaterThan(1)
})

test('leaderboard renders', async ({ page }) => {
  await page.goto('/leaderboard')

  await expect(page.locator('#leaderboard-body')).not.toContainText('Loading...')
  expect(await page.locator('#leaderboard-body tr').count()).toBeGreaterThan(1)
})

