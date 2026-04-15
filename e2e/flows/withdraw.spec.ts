/**
 * Withdraw flow — covers both crypto and bank withdrawal paths.
 *
 * Exercises:
 *   - WithdrawFlowContext (flow context being consolidated)
 *   - Redux bank-form state (being killed)
 *   - DynamicBankAccountForm (pain #14, CC 133)
 *   - AddWithdrawCountriesList / AddWithdrawRouterView
 *   - Bridge/Manteca withdrawal paths
 *
 * Captures entry points and country selection without initiating real withdrawals.
 */

import { test, expect } from '@playwright/test'
import { captureStep, collectConsoleLogs } from '../utils/capture'

test.describe('Withdraw flow', () => {
	test('withdraw landing — shows method selection', async ({ page }, testInfo) => {
		const console = collectConsoleLogs(page)

		await page.goto('/withdraw')
		await captureStep(page, testInfo, { name: '01-withdraw-landing' })

		// Should show withdrawal options (crypto, bank, etc.)
		await page.waitForTimeout(2000)
		await captureStep(page, testInfo, { name: '02-withdraw-loaded' })

		console.flush(testInfo, 'withdraw-landing')
	})

	test('withdraw/crypto — crypto withdrawal page', async ({ page }, testInfo) => {
		const console = collectConsoleLogs(page)

		await page.goto('/withdraw/crypto')
		await captureStep(page, testInfo, { name: '01-withdraw-crypto-initial' })

		await page.waitForTimeout(2000)
		await captureStep(page, testInfo, { name: '02-withdraw-crypto-loaded' })

		console.flush(testInfo, 'withdraw-crypto')
	})

	test('withdraw/manteca — ARS/LATAM withdrawal', async ({ page }, testInfo) => {
		const console = collectConsoleLogs(page)

		await page.goto('/withdraw/manteca')
		await captureStep(page, testInfo, { name: '01-withdraw-manteca-initial' })

		await page.waitForTimeout(2000)
		await captureStep(page, testInfo, { name: '02-withdraw-manteca-loaded' })

		console.flush(testInfo, 'withdraw-manteca')
	})

	test('withdraw/AR/bank — Argentina bank withdrawal', async ({ page }, testInfo) => {
		const console = collectConsoleLogs(page)

		await page.goto('/withdraw/AR/bank')
		await captureStep(page, testInfo, { name: '01-withdraw-ar-bank-initial' })

		await page.waitForTimeout(2000)
		await captureStep(page, testInfo, { name: '02-withdraw-ar-bank-loaded' })

		console.flush(testInfo, 'withdraw-ar-bank')
	})
})
