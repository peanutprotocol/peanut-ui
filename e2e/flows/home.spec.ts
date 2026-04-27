/**
 * Home page flow — primary landing for authenticated users.
 *
 * Uses the 'with-history' persona so screenshots show realistic activity
 * instead of empty new-user state. Falls back to default user if persona
 * isn't available.
 *
 * Mocks API calls (history, metrics) because the UI defaults to
 * api.peanut.me (prod) which rejects local JWT tokens.
 */

import { test, expect, devices } from '@playwright/test'
import { captureStep, collectConsoleLogs } from '../utils/capture'
import { dismissModals } from '../utils/dismiss-modals'
import { installApiMocks } from '../utils/mock-api'
import { usePersona } from '../utils/personas'

test.describe('Home page', () => {
    test('authenticated home renders with core elements', async ({ page }, testInfo) => {
        const consoleLogs = collectConsoleLogs(page)
        await installApiMocks(page)

        await page.goto('/home')
        await page.waitForTimeout(3000)
        await dismissModals(page)
        await captureStep(page, testInfo, { name: '01-home-initial' })

        // Wait for content to load past any loading spinners
        await page.waitForTimeout(5000)
        await dismissModals(page)
        await captureStep(page, testInfo, { name: '02-home-settled' })

        // Verify no error states
        const errorState = page.locator('text=/Error loading/i')
        expect(await errorState.count()).toBe(0)

        // Verify page rendered (not stuck on loading/error)
        const bodyText = await page.locator('body').innerText()
        expect(bodyText).toContain('Send')

        // Scroll to see history
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
        await captureStep(page, testInfo, { name: '03-home-scrolled' })

        consoleLogs.flush(testInfo, 'home')
    })

    test('home with history persona — shows activity', async ({ browser }, testInfo) => {
        const context = await browser.newContext({ ...devices['Pixel 7'] })
        const persona = await usePersona(context, 'with-history')

        const page = await context.newPage()
        const consoleLogs = collectConsoleLogs(page)
        await installApiMocks(page)

        await page.goto('/home')
        await page.waitForTimeout(3000)
        await dismissModals(page)
        await captureStep(page, testInfo, { name: '01-home-history-initial' })

        await page.waitForTimeout(5000)
        await dismissModals(page)
        await captureStep(page, testInfo, { name: '02-home-history-settled' })

        // Verify no error states
        const errorState = page.locator('text=/Error loading/i')
        expect(await errorState.count()).toBe(0)

        // Scroll to see history section
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
        await captureStep(page, testInfo, { name: '03-home-history-scrolled' })

        if (persona) {
            testInfo.annotations.push({
                type: 'persona',
                description: `with-history (${persona.userId})`,
            })
        }

        consoleLogs.flush(testInfo, 'home-history')
        await context.close()
    })
})
