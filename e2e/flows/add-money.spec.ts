/**
 * Add money (onramp) flow.
 *
 * Uses 'verified-ar' persona for AR tests and 'verified-us' for US tests
 * so country-specific forms render instead of "Country not found" errors.
 *
 * Exercises:
 *   - OnrampFlowContext (flow context being consolidated)
 *   - AddMoneyBankDetails (pain #23 UI, Bridge fee bug site)
 *   - ExchangeRate component (Bridge fee display)
 *   - Country-specific onramp paths (AR/Manteca, EUR/Bridge, USD/Bridge)
 *   - MUI usage in some components (being killed)
 *
 * Captures entry + country selection without real payment.
 */

import { test, expect, devices } from '@playwright/test'
import { captureStep, collectConsoleLogs } from '../utils/capture'
import { installApiMocks } from '../utils/mock-api'
import { usePersona } from '../utils/personas'

test.describe('Add money flow', () => {
    test('add-money landing', async ({ page }, testInfo) => {
        const consoleLogs = collectConsoleLogs(page)

        await page.goto('/add-money')
        await captureStep(page, testInfo, { name: '01-add-money-landing' })

        await page.waitForTimeout(2000)
        await captureStep(page, testInfo, { name: '02-add-money-loaded' })

        consoleLogs.flush(testInfo, 'add-money')
    })

    test('add-money/AR/bank — Argentina bank onramp (verified-ar)', async ({ browser }, testInfo) => {
        const context = await browser.newContext({ ...devices['Pixel 7'] })
        const persona = await usePersona(context, 'verified-ar')

        const page = await context.newPage()
        const consoleLogs = collectConsoleLogs(page)
        await installApiMocks(page)

        await page.goto('/add-money/AR/bank')
        await captureStep(page, testInfo, { name: '01-add-money-ar-bank-initial' })

        await page.waitForTimeout(3000)
        await captureStep(page, testInfo, { name: '02-add-money-ar-bank-loaded' })

        if (persona) {
            testInfo.annotations.push({
                type: 'persona',
                description: `verified-ar (${persona.userId})`,
            })
        }

        consoleLogs.flush(testInfo, 'add-money-ar-bank')
        await context.close()
    })

    test('add-money/US/bank — US bank onramp (verified-us)', async ({ browser }, testInfo) => {
        const context = await browser.newContext({ ...devices['Pixel 7'] })
        const persona = await usePersona(context, 'verified-us')

        const page = await context.newPage()
        const consoleLogs = collectConsoleLogs(page)
        await installApiMocks(page)

        await page.goto('/add-money/US/bank')
        await captureStep(page, testInfo, { name: '01-add-money-us-bank-initial' })

        await page.waitForTimeout(3000)
        await captureStep(page, testInfo, { name: '02-add-money-us-bank-loaded' })

        if (persona) {
            testInfo.annotations.push({
                type: 'persona',
                description: `verified-us (${persona.userId})`,
            })
        }

        consoleLogs.flush(testInfo, 'add-money-us-bank')
        await context.close()
    })

    // Regression: the NavHeader back button must LEAVE the amount screen on the first tap.
    // Before fix/addmoney-back-nuqs-replace the flow used nuqs { history: 'push' }, so every
    // amount keystroke stacked a same-screen history entry and useSafeBack's router.back()
    // only stepped through stale amounts — the back button looked dead (MP/bank reports).
    test('add-money/AR/bank — back button leaves the amount screen after typing (verified-ar)', async ({
        browser,
    }, testInfo) => {
        const context = await browser.newContext({ ...devices['Pixel 7'] })
        await usePersona(context, 'verified-ar')

        const page = await context.newPage()
        const consoleLogs = collectConsoleLogs(page)
        await installApiMocks(page)

        await page.goto('/add-money/AR/bank')

        // amount step renders (verified persona skips the "country not found" gate)
        const amountInput = page.locator('input[inputmode="decimal"]').first()
        await amountInput.waitFor({ state: 'visible', timeout: 15000 })

        // typing writes ?amount= — with the old { history: 'push' } this stacked back-stack
        // entries; with the default 'replace' it does not.
        await amountInput.fill('100')
        await captureStep(page, testInfo, { name: '01-add-money-ar-bank-amount-typed' })

        // one tap must exit to the country page, not linger on /bank with a stale amount
        await page.locator('[data-testid="nav-back"]').first().click()
        await expect(page).toHaveURL(/\/add-money\/AR(?:\?.*)?$/)
        await captureStep(page, testInfo, { name: '02-add-money-ar-bank-back-left-screen' })

        consoleLogs.flush(testInfo, 'add-money-ar-bank-back')
        await context.close()
    })
})
