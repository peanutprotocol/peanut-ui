/**
 * Add money (onramp) flow.
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

import { test, expect } from '@playwright/test'
import { captureStep, collectConsoleLogs } from '../utils/capture'

test.describe('Add money flow', () => {
	test('add-money landing', async ({ page }, testInfo) => {
		const console = collectConsoleLogs(page)

		await page.goto('/add-money')
		await captureStep(page, testInfo, { name: '01-add-money-landing' })

		await page.waitForTimeout(2000)
		await captureStep(page, testInfo, { name: '02-add-money-loaded' })

		console.flush(testInfo, 'add-money')
	})

	test('add-money/AR/bank — Argentina bank onramp (Manteca)', async ({ page }, testInfo) => {
		const console = collectConsoleLogs(page)

		await page.goto('/add-money/AR/bank')
		await captureStep(page, testInfo, { name: '01-add-money-ar-bank-initial' })

		await page.waitForTimeout(3000)
		await captureStep(page, testInfo, { name: '02-add-money-ar-bank-loaded' })

		console.flush(testInfo, 'add-money-ar-bank')
	})

	test('add-money/US/bank — US bank onramp (Bridge)', async ({ page }, testInfo) => {
		const console = collectConsoleLogs(page)

		await page.goto('/add-money/US/bank')
		await captureStep(page, testInfo, { name: '01-add-money-us-bank-initial' })

		await page.waitForTimeout(3000)
		await captureStep(page, testInfo, { name: '02-add-money-us-bank-loaded' })

		console.flush(testInfo, 'add-money-us-bank')
	})
})
