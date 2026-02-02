import { test, expect } from '@playwright/test'

/**
 * Card Pioneer E2E Tests
 *
 * Tests navigation flow through card pioneer purchase journey.
 * Does NOT test actual payments (requires real transactions).
 *
 * Note: Card Pioneer pages require authentication. Unauthenticated users
 * are redirected to /setup for onboarding.
 *
 * Flow: info → details → geo → purchase → success
 */

test.describe('Card Pioneer Flow', () => {
    test('should redirect unauthenticated users to setup', async ({ page }) => {
        // navigate to card pioneer page without auth
        await page.goto('/card')

        // should redirect to setup for onboarding
        await expect(page).toHaveURL(/\/setup/)
    })

    test('should redirect direct step navigation to setup when unauthenticated', async ({ page }) => {
        // try to directly navigate to details step without auth
        await page.goto('/card?step=details')

        // should redirect to setup
        await expect(page).toHaveURL(/\/setup/)
    })

    test('should redirect purchase step to setup when unauthenticated', async ({ page }) => {
        // try to access purchase step directly without auth
        await page.goto('/card?step=purchase')

        // should redirect to setup
        await expect(page).toHaveURL(/\/setup/)
    })

    test('should skip geo step if user is already eligible', async () => {
        // this test requires mocking the card info API response
        // skip for now - E2E tests shouldn't mock APIs extensively
        test.skip()
    })
})

test.describe('Card Pioneer Auth Gating', () => {
    test('should require authentication to access card pioneer flow', async ({ page }) => {
        // attempt to access card page directly
        await page.goto('/card')

        // should redirect to setup for onboarding (not login/signin)
        await expect(page).toHaveURL(/\/setup/)
    })

    test('should require authentication to access purchase flow', async ({ page }) => {
        // attempt to access purchase step directly
        await page.goto('/card?step=purchase')

        // should redirect to setup for onboarding
        await expect(page).toHaveURL(/\/setup/)
    })
})
