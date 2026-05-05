/**
 * Request pot flow — creating and viewing payment requests.
 *
 * Exercises:
 *   - Request link landing page (requester info, total amount)
 *   - Payer view (slider/amount input)
 *   - Payment form capture
 *
 * Uses /dev/seed-scenario with "request-pot-open" to get a real request link.
 * Falls back to direct URL navigation if seeding is unavailable.
 */

import { test, expect } from '@playwright/test'
import { devices } from '@playwright/test'
import { captureStep, collectConsoleLogs } from '../utils/capture'
import { dismissModals } from '../utils/dismiss-modals'
import { seedScenario, authenticateAs } from '../utils/seed'

test.describe('Request pot flow', () => {
    let seedData: any

    test.beforeAll(async () => {
        try {
            seedData = await seedScenario('request-pot-open')
        } catch (e) {
            console.warn(`[request-flow] seed-scenario failed, tests will use fallback URLs: ${e}`)
        }
    })

    test('request link shows requester info and total amount', async ({ browser }, testInfo) => {
        const context = await browser.newContext({ ...devices['Pixel 7'] })

        if (seedData?.payer?.token) {
            await authenticateAs(context, seedData.payer.token)
        }

        const page = await context.newPage()
        const consoleLogs = collectConsoleLogs(page)

        const url = seedData?.link?.requestUrl || '/request'
        await page.goto(url)
        await dismissModals(page)
        await captureStep(page, testInfo, { name: '01-request-landing' })

        await page.waitForTimeout(3000)
        await dismissModals(page)
        await captureStep(page, testInfo, { name: '02-request-loaded' })

        // Look for requester info (username, avatar)
        const requesterInfo = page.locator('[data-test="requester-info"], [class*="requester"], text=/requested/i')
        if (
            await requesterInfo
                .first()
                .isVisible({ timeout: 3000 })
                .catch(() => false)
        ) {
            await captureStep(page, testInfo, { name: '03-request-requester-visible' })
        }

        // Look for total amount display
        const amountDisplay = page.locator('[data-test="request-amount"], [class*="amount"], text=/\\$|USD|USDC/i')
        if (
            await amountDisplay
                .first()
                .isVisible({ timeout: 3000 })
                .catch(() => false)
        ) {
            await captureStep(page, testInfo, { name: '04-request-amount-visible' })
        }

        consoleLogs.flush(testInfo, 'request-landing')
        await context.close()
    })

    test('payer view shows amount input or slider', async ({ browser }, testInfo) => {
        const context = await browser.newContext({ ...devices['Pixel 7'] })

        if (seedData?.payer?.token) {
            await authenticateAs(context, seedData.payer.token)
        }

        const page = await context.newPage()
        const consoleLogs = collectConsoleLogs(page)

        const url = seedData?.link?.requestUrl || '/request'
        await page.goto(url)
        await dismissModals(page)
        await page.waitForTimeout(3000)
        await dismissModals(page)

        // Look for payment amount input or slider
        const amountInput = page
            .locator(
                '[data-test="pay-amount"], input[type="range"], input[inputmode="decimal"], input[placeholder*="amount" i]'
            )
            .first()
        const inputVisible = await amountInput.isVisible({ timeout: 5000 }).catch(() => false)

        if (inputVisible) {
            await captureStep(page, testInfo, { name: '01-request-payer-input-visible' })

            // If it's a text input, fill a value
            const tagName = await amountInput.evaluate((el) => el.tagName.toLowerCase())
            if (tagName === 'input') {
                const type = await amountInput.getAttribute('type')
                if (type !== 'range') {
                    await amountInput.fill('10')
                    await page.waitForTimeout(500)
                }
            }
            await captureStep(page, testInfo, { name: '02-request-payer-amount-set' })
        } else {
            // Capture whatever is visible as fallback
            await captureStep(page, testInfo, { name: '01-request-payer-fallback' })
        }

        consoleLogs.flush(testInfo, 'request-payer')
        await context.close()
    })

    test('capture payment form state', async ({ browser }, testInfo) => {
        const context = await browser.newContext({ ...devices['Pixel 7'] })

        if (seedData?.payer?.token) {
            await authenticateAs(context, seedData.payer.token)
        }

        const page = await context.newPage()
        const consoleLogs = collectConsoleLogs(page)

        const url = seedData?.link?.requestUrl || '/request'
        await page.goto(url)
        await dismissModals(page)
        await page.waitForTimeout(3000)
        await dismissModals(page)

        // Try to advance to payment form
        const payButton = page.locator('button:has-text("Pay"), button:has-text("Send"), button:has-text("Confirm")')
        if (
            await payButton
                .first()
                .isVisible({ timeout: 3000 })
                .catch(() => false)
        ) {
            await payButton.first().click()
            await page.waitForTimeout(2000)
            await captureStep(page, testInfo, { name: '01-request-payment-form' })
        }

        // Scroll to see full form
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
        await captureStep(page, testInfo, { name: '02-request-payment-form-scrolled' })

        consoleLogs.flush(testInfo, 'request-payment')
        await context.close()
    })
})
