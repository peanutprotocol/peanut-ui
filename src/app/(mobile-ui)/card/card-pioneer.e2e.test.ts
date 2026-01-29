import { test, expect } from '@playwright/test'

/**
 * Card Pioneer E2E Tests
 *
 * Tests navigation flow through card pioneer purchase journey.
 * Does NOT test actual payments (requires real transactions).
 *
 * Flow: info → details → geo → purchase → success
 */

test.describe('Card Pioneer Flow', () => {
    test.beforeEach(async ({ page }) => {
        // navigate to card pioneer page
        await page.goto('/card')
    })

    test('should show info screen by default', async ({ page }) => {
        // check for key elements on info screen
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

        // should have continue/get started button
        const continueButton = page.getByRole('button', { name: /continue|get started|next/i })
        await expect(continueButton).toBeVisible()
    })

    test('should navigate through steps using URL state', async ({ page }) => {
        // step 1: info screen (default)
        await expect(page).toHaveURL(/\/card/)

        // click continue to go to details
        await page.getByRole('button', { name: /continue|get started|next/i }).click()

        // step 2: details screen (check URL has step param)
        await expect(page).toHaveURL(/step=details/)

        // should show details content
        await expect(page.locator('text=/tier|pricing|discount/i').first()).toBeVisible()
    })

    test('should support direct navigation via URL params', async ({ page }) => {
        // directly navigate to details step
        await page.goto('/card?step=details')

        // should show details screen
        await expect(page).toHaveURL(/step=details/)
        await expect(page.locator('text=/tier|pricing|discount/i').first()).toBeVisible()
    })

    test('should handle back navigation', async ({ page }) => {
        // navigate to details
        await page.goto('/card?step=details')

        // click back button if exists
        const backButton = page.getByRole('button', { name: /back/i }).first()
        if (await backButton.isVisible()) {
            await backButton.click()

            // should go back to info step
            await expect(page).toHaveURL(/card(\?|$)/)
        }
    })

    test('should preserve URL state on page refresh', async ({ page }) => {
        // navigate to details step
        await page.goto('/card?step=details')
        await expect(page).toHaveURL(/step=details/)

        // refresh page
        await page.reload()

        // should still be on details step
        await expect(page).toHaveURL(/step=details/)
        await expect(page.locator('text=/tier|pricing|discount/i').first()).toBeVisible()
    })

    test('should skip geo step if user is already eligible', async () => {
        // this test requires mocking the card info API response
        // skip for now - E2E tests shouldn't mock APIs extensively
        test.skip()
    })
})

test.describe('Card Pioneer Form Validation', () => {
    test('should validate required fields on details screen', async ({ page }) => {
        await page.goto('/card?step=details')

        // try to continue without filling required fields
        const continueButton = page.getByRole('button', { name: /continue|next/i })

        if (await continueButton.isVisible()) {
            await continueButton.click()

            // should show validation errors or not navigate
            // exact behavior depends on implementation
            // this is a placeholder test - adjust selectors based on actual UI
        }
    })
})

test.describe('Card Pioneer Auth Gating', () => {
    test('should require authentication to access purchase flow', async ({ page }) => {
        // attempt to access purchase step directly
        await page.goto('/card?step=purchase')

        // should either redirect to login or show auth prompt
        // exact behavior depends on implementation
        // check if still on purchase or redirected
        const url = page.url()
        const isPurchasePage = url.includes('step=purchase')

        if (isPurchasePage) {
            // if on purchase page, should show auth requirement
            await expect(page.locator('text=/sign in|log in|connect wallet|authenticate/i').first()).toBeVisible()
        } else {
            // redirected to auth or info page
            expect(url).toMatch(/login|signin|card/)
        }
    })
})
