/**
 * Home page flow — primary landing for authenticated users.
 */

import { test, expect } from '@playwright/test'
import { captureStep, collectConsoleLogs } from '../utils/capture'
import { dismissModals } from '../utils/dismiss-modals'

test.describe('Home page', () => {
	test('authenticated home renders with core elements', async ({ page }, testInfo) => {
		const console = collectConsoleLogs(page)

		await page.goto('/home')
		await page.waitForTimeout(3000)
		await dismissModals(page)
		await captureStep(page, testInfo, { name: '01-home-initial' })

		// Wait for content to load past any loading spinners
		await page.waitForTimeout(5000)
		await dismissModals(page)
		await captureStep(page, testInfo, { name: '02-home-settled' })

		// Scroll to see history
		await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
		await captureStep(page, testInfo, { name: '03-home-scrolled' })

		console.flush(testInfo, 'home')
	})
})
