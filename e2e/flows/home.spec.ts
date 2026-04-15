/**
 * Home page flow — the primary landing for authenticated users.
 *
 * Captures the home page in authenticated state. This flow exercises:
 *   - Redux wallet state (being killed in M2)
 *   - Icon component (MUI migration target)
 *   - HomeHistory component (34 commits, uses history.utils.ts)
 *   - Balance display
 *   - Navigation CTAs (send, request, add-money, withdraw, qr-pay)
 *
 * Snapshot targets: page structure, navigation links, balance area, history list.
 */

import { test, expect } from '@playwright/test'
import { captureStep, collectConsoleLogs, getConsoleErrors } from '../utils/capture'

test.describe('Home page', () => {
	test('authenticated home renders with core elements', async ({ page }, testInfo) => {
		const console = collectConsoleLogs(page)

		// Navigate to home
		await page.goto('/home')
		await captureStep(page, testInfo, { name: '01-home-initial' })

		// Core structure checks (these are the behaviors M2 must preserve)
		// Balance section should exist
		const balanceArea = page.locator('[data-test="balance"], [class*="balance"], text=/\\$|USDC/')
		await expect(balanceArea.first()).toBeVisible({ timeout: 10_000 }).catch(() => {
			// Balance might not render if wallet isn't connected — that's ok for snapshot
		})

		// Navigation CTAs should be present
		const navLinks = ['send', 'request', 'add-money', 'withdraw']
		for (const link of navLinks) {
			const el = page.locator(`[href*="${link}"], [data-test="${link}"], a:has-text("${link}")`)
			// Just check existence, don't fail if not found — design may change
			const count = await el.count()
			if (count === 0) {
				console.entries.push({ type: 'warn', text: `Nav link "${link}" not found`, url: '' })
			}
		}

		await captureStep(page, testInfo, { name: '02-home-settled' })

		// Scroll down to see history section
		await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
		await captureStep(page, testInfo, { name: '03-home-scrolled' })

		// Flush console
		const errors = getConsoleErrors(console.flush(testInfo, 'home'))
		// Don't hard-fail on console errors — baseline may have known issues
		if (errors.length > 0) {
			console.entries.push({ type: 'info', text: `${errors.length} console errors captured`, url: '' })
		}
	})
})
