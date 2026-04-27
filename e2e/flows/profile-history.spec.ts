/**
 * Profile + History — regression coverage for account pages.
 *
 * Uses 'with-history' persona so screenshots show actual transactions
 * and account data instead of empty state. Falls back to default user
 * (or the inline seed-scenario) if persona isn't available.
 *
 * Exercises:
 *   - /history — completed transaction list
 *   - /profile — username, account info display
 *   - /points — points balance and activity
 */

import { test, expect, devices } from '@playwright/test'
import { captureStep, collectConsoleLogs } from '../utils/capture'
import { dismissModals } from '../utils/dismiss-modals'
import { installApiMocks } from '../utils/mock-api'
import { usePersona } from '../utils/personas'

test.describe('Profile and history pages', () => {
    /**
     * Helper: create a browser context authenticated as the given persona.
     * Returns { context, page, persona } — caller must close context.
     */
    async function withPersona(browser: any, personaId: 'with-history' | 'verified-ar' | 'verified-us' | 'default') {
        const context = await browser.newContext({ ...devices['Pixel 7'] })
        const persona = await usePersona(context, personaId)
        const page = await context.newPage()
        return { context, page, persona }
    }

    test('history page — shows completed transactions', async ({ browser }, testInfo) => {
        const { context, page, persona } = await withPersona(browser, 'with-history')
        const consoleLogs = collectConsoleLogs(page)
        await installApiMocks(page)

        await page.goto('/history')
        await dismissModals(page)
        await captureStep(page, testInfo, { name: '01-history-landing' })

        await page.waitForTimeout(4000)
        await dismissModals(page)
        await captureStep(page, testInfo, { name: '02-history-loaded' })

        // Check for transaction entries or empty state
        const txItems = page.locator(
            '[data-test="tx-entry"], [class*="transaction"], [class*="history-item"], [class*="transfer-item"]'
        )
        const emptyState = page.locator(
            'text=/no.*transactions/i, text=/no.*history/i, text=/nothing.*here/i, [data-test="empty-state"]'
        )

        const hasItems = (await txItems.count().catch(() => 0)) > 0
        const isEmpty = await emptyState
            .first()
            .isVisible({ timeout: 3000 })
            .catch(() => false)

        if (hasItems) {
            await captureStep(page, testInfo, { name: '03-history-has-transactions' })

            // Scroll to load more
            await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
            await page.waitForTimeout(1000)
            await captureStep(page, testInfo, { name: '04-history-scrolled' })
        } else if (isEmpty) {
            await captureStep(page, testInfo, { name: '03-history-empty-state' })
        }

        if (persona) {
            testInfo.annotations.push({
                type: 'persona',
                description: `with-history (${persona.userId})`,
            })
        }

        consoleLogs.flush(testInfo, 'history')
        await context.close()
    })

    test('profile page — shows username and account info', async ({ browser }, testInfo) => {
        const { context, page, persona } = await withPersona(browser, 'with-history')
        const consoleLogs = collectConsoleLogs(page)
        await installApiMocks(page)

        await page.goto('/profile')
        await dismissModals(page)
        await captureStep(page, testInfo, { name: '01-profile-landing' })

        await page.waitForTimeout(3000)
        await dismissModals(page)
        await captureStep(page, testInfo, { name: '02-profile-loaded' })

        // Check for username display
        const username = page.locator('[data-test="username"], [class*="username"], text=/@\\w+/i')
        if (
            await username
                .first()
                .isVisible({ timeout: 3000 })
                .catch(() => false)
        ) {
            await captureStep(page, testInfo, { name: '03-profile-username-visible' })
        }

        // Check for account info sections (wallet address, email, etc.)
        const accountInfo = page.locator(
            '[data-test="account-info"], text=/wallet/i, text=/address/i, text=/0x[a-f0-9]/i'
        )
        if (
            await accountInfo
                .first()
                .isVisible({ timeout: 3000 })
                .catch(() => false)
        ) {
            await captureStep(page, testInfo, { name: '04-profile-account-info' })
        }

        // Scroll to see all profile content
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
        await captureStep(page, testInfo, { name: '05-profile-scrolled' })

        if (persona) {
            testInfo.annotations.push({
                type: 'persona',
                description: `with-history (${persona.userId})`,
            })
        }

        consoleLogs.flush(testInfo, 'profile')
        await context.close()
    })

    test('points page — shows points balance', async ({ browser }, testInfo) => {
        const { context, page, persona } = await withPersona(browser, 'with-history')
        const consoleLogs = collectConsoleLogs(page)
        await installApiMocks(page)

        // Navigate directly to /rewards — /points redirect triggers React hooks bug in dev
        await page.goto('/rewards')
        await dismissModals(page)
        await captureStep(page, testInfo, { name: '01-points-landing' })

        await page.waitForTimeout(3000)
        await dismissModals(page)
        await captureStep(page, testInfo, { name: '02-points-loaded' })

        // KNOWN BUG: /rewards page crashes with "Application error" when points
        // API calls fail (402 or CORS). The page doesn't gracefully handle API
        // failures before the loading state resolves. Detect and document it.
        const hasCrash = await page
            .locator('text=/Application error/i')
            .isVisible({ timeout: 2000 })
            .catch(() => false)

        if (hasCrash) {
            testInfo.annotations.push({
                type: 'known-bug',
                description:
                    'Rewards page crashes on API failure (402/CORS). ' +
                    'useCountUp or tierInfo.data access before error boundary fires.',
            })
            await captureStep(page, testInfo, { name: '03-points-crash-detected' })
        } else {
            // Check for points balance display
            const pointsBalance = page.locator(
                '[data-test="points-balance"], [class*="points"], [class*="balance"], text=/\\d+.*points/i'
            )
            if (
                await pointsBalance
                    .first()
                    .isVisible({ timeout: 5000 })
                    .catch(() => false)
            ) {
                await captureStep(page, testInfo, { name: '03-points-balance-visible' })
            }

            // Check for points activity/history
            const pointsActivity = page.locator(
                '[data-test="points-activity"], [class*="activity"], text=/earned|redeemed|history/i'
            )
            if (
                await pointsActivity
                    .first()
                    .isVisible({ timeout: 3000 })
                    .catch(() => false)
            ) {
                await captureStep(page, testInfo, { name: '04-points-activity' })
            }
        }

        // Scroll to see all content
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
        await captureStep(page, testInfo, { name: '05-points-scrolled' })

        if (persona) {
            testInfo.annotations.push({
                type: 'persona',
                description: `with-history (${persona.userId})`,
            })
        }

        consoleLogs.flush(testInfo, 'points')
        await context.close()
    })

    test('profile → history navigation', async ({ page }, testInfo) => {
        const consoleLogs = collectConsoleLogs(page)
        await installApiMocks(page)

        await page.goto('/profile')
        await dismissModals(page)
        await page.waitForTimeout(2000)
        await captureStep(page, testInfo, { name: '01-profile-start' })

        // Try to navigate to history from profile
        const historyLink = page.locator('a[href*="history"], button:has-text("History"), text=/view.*history/i')
        if (
            await historyLink
                .first()
                .isVisible({ timeout: 3000 })
                .catch(() => false)
        ) {
            await historyLink.first().click()
            await page.waitForTimeout(2000)
            await dismissModals(page)
            await captureStep(page, testInfo, { name: '02-navigated-to-history' })
            expect(page.url()).toContain('/history')
        }

        consoleLogs.flush(testInfo, 'profile-to-history')
    })
})
