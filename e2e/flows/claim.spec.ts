/**
 * Claim flow — claiming a send link.
 *
 * Exercises:
 *   - Claim/Link/Initial.view.tsx (pain #5, CC 211)
 *   - BankFlowManager.view.tsx (pain #21)
 *   - Claim.tsx (pain #22)
 *   - TransactionDetailsReceipt (pain #3, 3 receipt shapes)
 *
 * We need a real send link pubKey to test. Since we're using the test harness,
 * we rely on the API seeding a link via the state factories.
 * For now, test the unauthenticated claim landing state.
 */

import { test, expect } from '@playwright/test'
import { captureStep, collectConsoleLogs } from '../utils/capture'

test.describe('Claim flow', () => {
    test('claim page without pubKey — error state', async ({ page }, testInfo) => {
        const consoleLogs = collectConsoleLogs(page)

        await page.goto('/claim')
        await captureStep(page, testInfo, { name: '01-claim-no-pubkey' })

        await page.waitForTimeout(2000)
        await captureStep(page, testInfo, { name: '02-claim-no-pubkey-settled' })

        consoleLogs.flush(testInfo, 'claim-no-pubkey')
    })

    test('claim page with invalid pubKey', async ({ page }, testInfo) => {
        const consoleLogs = collectConsoleLogs(page)

        await page.goto('/claim?pubKey=0xinvalid')
        await captureStep(page, testInfo, { name: '01-claim-invalid-pubkey' })

        await page.waitForTimeout(3000)
        await captureStep(page, testInfo, { name: '02-claim-invalid-pubkey-settled' })

        consoleLogs.flush(testInfo, 'claim-invalid')
    })
})
