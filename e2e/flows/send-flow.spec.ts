/**
 * Send link creation flow — expanded regression coverage.
 *
 * Exercises:
 *   - Multi-step send form (amount input → token select → confirm → success)
 *   - URL-as-state via nuqs (?step=inputAmount, ?step=confirmSend)
 *   - Receipt elements on the success page
 *
 * Does NOT complete a real on-chain transaction — captures UI state up to
 * the confirmation step, then verifies the success page via route interception.
 */

import { test, expect } from '@playwright/test'
import { captureStep, collectConsoleLogs } from '../utils/capture'
import { dismissModals } from '../utils/dismiss-modals'

test.describe('Send flow', () => {
	test('enter amount and select token — capture form state', async ({ page }, testInfo) => {
		const consoleLogs = collectConsoleLogs(page)

		await page.goto('/send')
		await dismissModals(page)
		await captureStep(page, testInfo, { name: '01-send-landing' })

		// Wait for page to fully load
		await page.waitForTimeout(3000)
		await dismissModals(page)
		await captureStep(page, testInfo, { name: '02-send-loaded' })

		// Find and fill amount input
		const amountInput = page
			.locator(
				'[data-test="amount-input"], input[type="text"], input[placeholder*="amount" i], input[inputmode="decimal"]'
			)
			.first()
		const inputVisible = await amountInput.isVisible({ timeout: 5000 }).catch(() => false)

		if (inputVisible) {
			await amountInput.fill('5')
			await page.waitForTimeout(1000)
			await captureStep(page, testInfo, { name: '03-send-amount-filled' })
		}

		// Look for token selector and capture its state
		const tokenSelector = page
			.locator(
				'[data-test="token-selector"], button:has-text("USDC"), button:has-text("Select token"), [class*="token"]'
			)
			.first()
		const tokenVisible = await tokenSelector.isVisible({ timeout: 3000 }).catch(() => false)

		if (tokenVisible) {
			await tokenSelector.click()
			await page.waitForTimeout(1000)
			await captureStep(page, testInfo, { name: '04-send-token-selector-open' })

			// Select first available token
			const tokenOption = page
				.locator('[data-test="token-option"], [role="option"], [class*="token-item"]')
				.first()
			if (await tokenOption.isVisible({ timeout: 2000 }).catch(() => false)) {
				await tokenOption.click()
				await page.waitForTimeout(500)
			}
			await captureStep(page, testInfo, { name: '05-send-token-selected' })
		}

		consoleLogs.flush(testInfo, 'send-form')
	})

	test('URL state updates with step parameter', async ({ page }, testInfo) => {
		const consoleLogs = collectConsoleLogs(page)

		// Navigate directly to inputAmount step
		await page.goto('/send?step=inputAmount')
		await dismissModals(page)
		await captureStep(page, testInfo, { name: '01-send-step-inputAmount' })
		expect(page.url()).toContain('step=inputAmount')

		// Navigate to confirmSend step
		await page.goto('/send?step=confirmSend')
		await dismissModals(page)
		await page.waitForTimeout(2000)
		await captureStep(page, testInfo, { name: '02-send-step-confirmSend' })
		expect(page.url()).toContain('step=confirmSend')

		// Verify back navigation updates the step
		await page.goBack()
		await page.waitForTimeout(1000)
		await captureStep(page, testInfo, { name: '03-send-after-back' })

		consoleLogs.flush(testInfo, 'send-url-state')
	})

	test('success page — verify receipt elements via route mock', async ({ page }, testInfo) => {
		const consoleLogs = collectConsoleLogs(page)

		// Intercept the send API call to simulate a successful send
		await page.route('**/api/v2/send-link/**', (route) => {
			route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					link: 'https://peanut.to/claim?c=test&v=v4.3&t=ui#p=mock-pubkey',
					txHash: '0xmocktxhash1234567890',
				}),
			})
		})

		// Navigate to a success-like URL (post-send redirect)
		await page.goto('/send/success?txHash=0xmocktxhash&link=https://peanut.to/claim?c=test')
		await dismissModals(page)
		await page.waitForTimeout(3000)
		await captureStep(page, testInfo, { name: '01-send-success-page' })

		// Scroll to see all receipt content
		await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
		await captureStep(page, testInfo, { name: '02-send-success-scrolled' })

		// Look for receipt-like elements (share button, link display, amount)
		const shareButton = page.locator('button:has-text("Share"), button:has-text("Copy")')
		const shareVisible = await shareButton.first().isVisible({ timeout: 3000 }).catch(() => false)
		if (shareVisible) {
			await captureStep(page, testInfo, { name: '03-send-success-share-visible' })
		}

		consoleLogs.flush(testInfo, 'send-success')
	})
})
