/**
 * KYC gate matrix — verifies claim page behavior based on sender/receiver KYC status.
 *
 * Exercises:
 *   - Bank withdrawal option visibility on claim pages
 *   - KYC-leveraged claims (verified sender enables bank for unverified receiver)
 *   - KYC blocking (unverified sender blocks bank for unverified receiver)
 *
 * Uses /dev/seed-scenario with "kyc-matrix" to get user tokens with different
 * KYC states. Link data is provided via page.route() interception (not seeded
 * DB links) to avoid SDK pubKey crypto verification failures.
 *
 * The pubKey in the mock response is extracted from the intercepted request URL
 * so the SDK's client-side generateKeysFromString check passes.
 */

import { test } from '@playwright/test'
import { devices } from '@playwright/test'
import { captureStep, collectConsoleLogs } from '../utils/capture'
import { dismissModals } from '../utils/dismiss-modals'
import { seedScenario, authenticateAs } from '../utils/seed'
import { interceptSendLinks } from '../utils/mock-api'

const CLAIM_URL = '/claim?c=42161&v=v4.3&i=0&p=testpassword123&t=ui'

test.describe('KYC gate matrix', () => {
    let seedData: any

    test.beforeAll(async () => {
        try {
            seedData = await seedScenario('kyc-matrix')
        } catch (e) {
            console.warn(`[kyc-gate] seed-scenario failed, tests will be skipped: ${e}`)
        }
    })

    test('verified sender → unverified receiver sees bank option (leveraged KYC)', async ({
        browser,
    }, testInfo) => {
        test.skip(!seedData, 'Requires kyc-matrix seed data')

        const context = await browser.newContext({ ...devices['Pixel 7'] })
        await authenticateAs(context, seedData.receiverUnverified.token)
        const page = await context.newPage()
        const consoleLogs = collectConsoleLogs(page)

        // Mock link with KYC-verified sender
        await interceptSendLinks(page, {
            sender: {
                userId: 'verified-sender',
                username: 'verifiedsender',
                bridgeKycStatus: 'approved',
            },
        })

        await page.goto(CLAIM_URL)
        await dismissModals(page)
        await page.waitForTimeout(4000)
        await dismissModals(page)
        await captureStep(page, testInfo, { name: '01-kyc-verified-sender-unverified-receiver' })

        // Bank option should be visible because sender is KYC verified
        const bankOption = page.locator(
            'button:has-text("Bank"), text=/bank.*account/i, [data-test="bank-option"]'
        )
        const bankVisible = await bankOption.first().isVisible({ timeout: 5000 }).catch(() => false)
        await captureStep(page, testInfo, {
            name: bankVisible ? '02-bank-option-visible' : '02-bank-option-not-found',
        })

        // Capture all claim method options
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
        await captureStep(page, testInfo, { name: '03-kyc-claim-options-full' })

        consoleLogs.flush(testInfo, 'kyc-verified-sender')
        await context.close()
    })

    test('unverified sender → unverified receiver — bank option blocked', async ({
        browser,
    }, testInfo) => {
        test.skip(!seedData, 'Requires kyc-matrix seed data')

        const context = await browser.newContext({ ...devices['Pixel 7'] })
        await authenticateAs(context, seedData.receiverUnverified.token)
        const page = await context.newPage()
        const consoleLogs = collectConsoleLogs(page)

        // Mock link with unverified sender (no KYC)
        await interceptSendLinks(page, {
            sender: {
                userId: 'unverified-sender',
                username: 'unverifiedsender',
                bridgeKycStatus: null,
            },
        })

        await page.goto(CLAIM_URL)
        await dismissModals(page)
        await page.waitForTimeout(4000)
        await dismissModals(page)
        await captureStep(page, testInfo, { name: '01-kyc-unverified-sender-unverified-receiver' })

        // Bank option should NOT be visible — neither party is verified
        const bankOption = page.locator(
            'button:has-text("Bank"), text=/bank.*account/i, [data-test="bank-option"]'
        )
        const bankVisible = await bankOption.first().isVisible({ timeout: 3000 }).catch(() => false)
        await captureStep(page, testInfo, {
            name: bankVisible ? '02-bank-option-unexpectedly-visible' : '02-bank-option-correctly-hidden',
        })

        // Look for KYC prompt instead
        const kycPrompt = page.locator('text=/verify.*identity/i, text=/KYC/i, text=/verification/i')
        if (await kycPrompt.first().isVisible({ timeout: 3000 }).catch(() => false)) {
            await captureStep(page, testInfo, { name: '03-kyc-prompt-visible' })
        }

        consoleLogs.flush(testInfo, 'kyc-unverified-both')
        await context.close()
    })

    test('verified receiver can claim to bank regardless of sender KYC', async ({
        browser,
    }, testInfo) => {
        test.skip(!seedData, 'Requires kyc-matrix seed data')

        const context = await browser.newContext({ ...devices['Pixel 7'] })
        await authenticateAs(context, seedData.receiverVerified.token)
        const page = await context.newPage()
        const consoleLogs = collectConsoleLogs(page)

        // Mock link with unverified sender — receiver's own KYC should suffice
        await interceptSendLinks(page, {
            sender: {
                userId: 'unverified-sender',
                username: 'unverifiedsender',
                bridgeKycStatus: null,
            },
        })

        await page.goto(CLAIM_URL)
        await dismissModals(page)
        await page.waitForTimeout(4000)
        await dismissModals(page)
        await captureStep(page, testInfo, { name: '01-kyc-unverified-sender-verified-receiver' })

        // Bank option should be visible because receiver is KYC verified
        const bankOption = page.locator(
            'button:has-text("Bank"), text=/bank.*account/i, [data-test="bank-option"]'
        )
        const bankVisible = await bankOption.first().isVisible({ timeout: 5000 }).catch(() => false)
        await captureStep(page, testInfo, {
            name: bankVisible ? '02-bank-option-visible' : '02-bank-option-not-found',
        })

        if (bankVisible) {
            await bankOption.first().click()
            await page.waitForTimeout(2000)
            await captureStep(page, testInfo, { name: '03-bank-claim-form' })
        }

        consoleLogs.flush(testInfo, 'kyc-verified-receiver')
        await context.close()
    })

    test('both verified — full claim options available', async ({ browser }, testInfo) => {
        test.skip(!seedData, 'Requires kyc-matrix seed data')

        const context = await browser.newContext({ ...devices['Pixel 7'] })
        await authenticateAs(context, seedData.receiverVerified.token)
        const page = await context.newPage()
        const consoleLogs = collectConsoleLogs(page)

        // Mock link with KYC-verified sender
        await interceptSendLinks(page, {
            sender: {
                userId: 'verified-sender',
                username: 'verifiedsender',
                bridgeKycStatus: 'approved',
            },
        })

        await page.goto(CLAIM_URL)
        await dismissModals(page)
        await page.waitForTimeout(4000)
        await dismissModals(page)
        await captureStep(page, testInfo, { name: '01-kyc-both-verified' })

        // Both bank and wallet options should be visible
        const bankOption = page.locator(
            'button:has-text("Bank"), text=/bank.*account/i, [data-test="bank-option"]'
        )
        const walletOption = page.locator(
            'button:has-text("Wallet"), button:has-text("Peanut"), [data-test="wallet-option"]'
        )

        const bankVisible = await bankOption.first().isVisible({ timeout: 5000 }).catch(() => false)
        const walletVisible = await walletOption.first().isVisible({ timeout: 3000 }).catch(() => false)

        await captureStep(page, testInfo, { name: '02-kyc-both-verified-options' })

        // Scroll to see all options
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
        await captureStep(page, testInfo, { name: '03-kyc-both-verified-scrolled' })

        consoleLogs.flush(testInfo, 'kyc-both-verified')
        await context.close()
    })
})
