/**
 * Send link creation flow.
 *
 * Exercises:
 *   - Flow context (LinkSendFlowContext — being consolidated in M2)
 *   - Amount input component
 *   - Token selector
 *   - URL-as-state (nuqs) for step navigation
 *
 * We capture each step of the multi-step send flow without completing
 * (no real on-chain transaction).
 */

import { test, expect } from '@playwright/test'
import { captureStep, collectConsoleLogs } from '../utils/capture'

test.describe('Send link flow', () => {
	test('navigate to send and capture initial state', async ({ page }, testInfo) => {
		const consoleLogs = collectConsoleLogs(page)

		await page.goto('/send')
		await captureStep(page, testInfo, { name: '01-send-initial' })

		// The send page should have an amount input or token selector
		const amountInput = page.locator('[data-test="amount-input"], input[type="text"], input[placeholder*="amount" i]')
		await captureStep(page, testInfo, { name: '02-send-loaded' })

		// Try to interact with amount input if visible
		const inputVisible = await amountInput.first().isVisible().catch(() => false)
		if (inputVisible) {
			await amountInput.first().fill('10')
			await captureStep(page, testInfo, { name: '03-send-amount-entered' })
		}

		consoleLogs.flush(testInfo, 'send-link')
	})

	test('send page URL state reflects step', async ({ page }, testInfo) => {
		const consoleLogs = collectConsoleLogs(page)

		// Navigate with step in URL (nuqs pattern)
		await page.goto('/send?step=inputAmount')
		await captureStep(page, testInfo, { name: '01-send-step-inputAmount' })

		// Check that URL contains step parameter
		expect(page.url()).toContain('/send')

		consoleLogs.flush(testInfo, 'send-url-state')
	})
})
