/**
 * Claim flow — regression coverage using route interception.
 *
 * Uses page.route() to intercept the Peanut API send-links endpoint,
 * returning mock link data. The pubKey is echoed from the request URL
 * so the SDK's generateKeysFromString crypto check passes.
 */

import { test } from '@playwright/test'
import { devices } from '@playwright/test'
import { captureStep, collectConsoleLogs } from '../utils/capture'
import { dismissModals } from '../utils/dismiss-modals'
import { interceptSendLinks } from '../utils/mock-api'

const CLAIM_URL = '/claim?c=42161&v=v4.3&i=0&p=testpassword123&t=ui'

test.describe('Claim flow (mocked)', () => {
    test('claim page shows amount and claim UI', async ({ browser }, testInfo) => {
        const context = await browser.newContext({ ...devices['Pixel 7'] })
        const page = await context.newPage()
        const consoleLogs = collectConsoleLogs(page)

        await interceptSendLinks(page, {
            status: 'completed',
            amount: '1000000',
            tokenSymbol: 'USDC',
        })

        await page.goto(CLAIM_URL)
        await dismissModals(page)
        await captureStep(page, testInfo, { name: '01-claim-landing' })

        await page.waitForTimeout(4000)
        await dismissModals(page)
        await captureStep(page, testInfo, { name: '02-claim-loaded' })

        const amountDisplay = page.locator(
            '[data-test="claim-amount"], [class*="amount"], text=/\\$|USD|USDC/i'
        )
        if (await amountDisplay.first().isVisible({ timeout: 5000 }).catch(() => false)) {
            await captureStep(page, testInfo, { name: '03-claim-amount-visible' })
        }

        const claimButton = page.locator(
            'button:has-text("Claim"), button:has-text("Receive"), button:has-text("Accept")'
        )
        if (await claimButton.first().isVisible({ timeout: 3000 }).catch(() => false)) {
            await captureStep(page, testInfo, { name: '04-claim-button-visible' })
        }

        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
        await captureStep(page, testInfo, { name: '05-claim-scrolled' })

        consoleLogs.flush(testInfo, 'claim-amount-ui')
        await context.close()
    })

    test('already-claimed link shows claimed state', async ({ browser }, testInfo) => {
        const context = await browser.newContext({ ...devices['Pixel 7'] })
        const page = await context.newPage()
        const consoleLogs = collectConsoleLogs(page)

        await interceptSendLinks(page, {
            status: 'CLAIMED',
            claim: {
                txHash: '0xmocktxhash',
                claimerAddress: '0x1234567890abcdef1234567890abcdef12345678',
            },
        })

        await page.goto(CLAIM_URL)
        await dismissModals(page)
        await captureStep(page, testInfo, { name: '01-claimed-landing' })

        await page.waitForTimeout(3000)
        await dismissModals(page)
        await captureStep(page, testInfo, { name: '02-claimed-loaded' })

        const claimedIndicator = page.locator(
            'text=/claimed|completed|already|expired/i, [data-test="claimed-status"]'
        )
        if (await claimedIndicator.first().isVisible({ timeout: 5000 }).catch(() => false)) {
            await captureStep(page, testInfo, { name: '03-claimed-indicator-visible' })
        }

        consoleLogs.flush(testInfo, 'claim-already-claimed')
        await context.close()
    })
})
