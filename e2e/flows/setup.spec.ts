/**
 * Setup / onboarding flow.
 *
 * Exercises:
 *   - Redux setup slice (being killed → nuqs migration)
 *   - Multi-step flow state
 *   - PWA install prompt
 *   - KYC onboarding entry point
 *
 * Captures each visible step. Passkey creation is skipped (handled by auth bypass).
 */

import { test, expect } from '@playwright/test'
import { captureStep, collectConsoleLogs } from '../utils/capture'

test.describe('Setup flow', () => {
	test('setup page — shows onboarding steps', async ({ page }, testInfo) => {
		const console = collectConsoleLogs(page)

		await page.goto('/setup')
		await captureStep(page, testInfo, { name: '01-setup-initial' })

		await page.waitForTimeout(2000)
		await captureStep(page, testInfo, { name: '02-setup-loaded' })

		console.flush(testInfo, 'setup')
	})

	test('profile page', async ({ page }, testInfo) => {
		const console = collectConsoleLogs(page)

		await page.goto('/profile')
		await captureStep(page, testInfo, { name: '01-profile-initial' })

		await page.waitForTimeout(2000)
		await captureStep(page, testInfo, { name: '02-profile-loaded' })

		console.flush(testInfo, 'profile')
	})

	test('points page', async ({ page }, testInfo) => {
		const console = collectConsoleLogs(page)

		await page.goto('/points')
		await captureStep(page, testInfo, { name: '01-points-initial' })

		await page.waitForTimeout(2000)
		await captureStep(page, testInfo, { name: '02-points-loaded' })

		console.flush(testInfo, 'points')
	})

	test('history page', async ({ page }, testInfo) => {
		const console = collectConsoleLogs(page)

		await page.goto('/history')
		await captureStep(page, testInfo, { name: '01-history-initial' })

		await page.waitForTimeout(2000)
		await captureStep(page, testInfo, { name: '02-history-loaded' })

		console.flush(testInfo, 'history')
	})
})
