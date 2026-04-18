/**
 * Withdraw flow — covers both crypto and bank withdrawal paths.
 *
 * Uses 'verified-ar' persona for Manteca/AR tests and 'with-history' persona
 * for tests that need saved accounts. Falls back to default user if personas
 * aren't available.
 *
 * Exercises:
 *   - WithdrawFlowContext (flow context being consolidated)
 *   - Redux bank-form state (being killed)
 *   - DynamicBankAccountForm (pain #14, CC 133)
 *   - AddWithdrawCountriesList / AddWithdrawRouterView
 *   - Bridge/Manteca withdrawal paths
 *
 * Captures entry points and country selection without initiating real withdrawals.
 * API mocks prevent "No accounts yet" from prod API rejection.
 */

import { test, expect, devices } from '@playwright/test'
import { captureStep, collectConsoleLogs } from '../utils/capture'
import { installApiMocks } from '../utils/mock-api'
import { usePersona } from '../utils/personas'

test.describe('Withdraw flow', () => {
	test('withdraw landing — shows method selection', async ({ page }, testInfo) => {
		const consoleLogs = collectConsoleLogs(page)
		await installApiMocks(page)

		await page.goto('/withdraw')
		await captureStep(page, testInfo, { name: '01-withdraw-landing' })

		// Should show withdrawal options (crypto, bank, etc.)
		await page.waitForTimeout(2000)
		await captureStep(page, testInfo, { name: '02-withdraw-loaded' })

		consoleLogs.flush(testInfo, 'withdraw-landing')
	})

	test('withdraw/crypto — crypto withdrawal page', async ({ page }, testInfo) => {
		const consoleLogs = collectConsoleLogs(page)
		await installApiMocks(page)

		await page.goto('/withdraw/crypto')
		await captureStep(page, testInfo, { name: '01-withdraw-crypto-initial' })

		await page.waitForTimeout(2000)
		await captureStep(page, testInfo, { name: '02-withdraw-crypto-loaded' })

		consoleLogs.flush(testInfo, 'withdraw-crypto')
	})

	test('withdraw/manteca — ARS/LATAM withdrawal (verified-ar)', async ({ browser }, testInfo) => {
		const context = await browser.newContext({ ...devices['Pixel 7'] })
		const persona = await usePersona(context, 'verified-ar')

		const page = await context.newPage()
		const consoleLogs = collectConsoleLogs(page)
		await installApiMocks(page)

		await page.goto('/withdraw/manteca')
		await captureStep(page, testInfo, { name: '01-withdraw-manteca-initial' })

		await page.waitForTimeout(2000)
		await captureStep(page, testInfo, { name: '02-withdraw-manteca-loaded' })

		if (persona) {
			testInfo.annotations.push({
				type: 'persona',
				description: `verified-ar (${persona.userId})`,
			})
		}

		consoleLogs.flush(testInfo, 'withdraw-manteca')
		await context.close()
	})

	test('withdraw/AR/bank — Argentina bank withdrawal (verified-ar)', async ({ browser }, testInfo) => {
		const context = await browser.newContext({ ...devices['Pixel 7'] })
		const persona = await usePersona(context, 'verified-ar')

		const page = await context.newPage()
		const consoleLogs = collectConsoleLogs(page)
		await installApiMocks(page)

		await page.goto('/withdraw/AR/bank')
		await captureStep(page, testInfo, { name: '01-withdraw-ar-bank-initial' })

		await page.waitForTimeout(2000)
		await captureStep(page, testInfo, { name: '02-withdraw-ar-bank-loaded' })

		if (persona) {
			testInfo.annotations.push({
				type: 'persona',
				description: `verified-ar (${persona.userId})`,
			})
		}

		consoleLogs.flush(testInfo, 'withdraw-ar-bank')
		await context.close()
	})
})
