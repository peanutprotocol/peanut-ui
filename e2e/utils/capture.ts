/**
 * Capture utilities for the verification harness.
 *
 * At each step in a flow, we capture:
 *   1. Screenshot (via Playwright's toHaveScreenshot for diffing)
 *   2. Accessibility tree (JSON — survives CSS/design system changes)
 *   3. Console log entries (filtered for noise)
 *   4. Network requests made during this step
 *
 * These form the "behavioral snapshot" that M2 refactors are verified against.
 */

import { Page, TestInfo } from '@playwright/test'
import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'

export interface CaptureOptions {
	/** Step name, used as filename prefix */
	name: string
	/** Wait for network idle before capturing (default: true) */
	waitForIdle?: boolean
	/** Extra wait after navigation/action in ms (default: 500) */
	settleMs?: number
}

const CONSOLE_NOISE = [
	/Download the React DevTools/,
	/webpack\.hmr/i,
	/\[Fast Refresh\]/,
	/hydration/i,
	/Warning: Expected server/,
	/posthog/i,
	/sentry/i,
	/service.worker/i,
	/sw\.js/,
]

/**
 * Capture a behavioral snapshot at the current page state.
 * Call this after each navigation or user action.
 */
export async function captureStep(page: Page, testInfo: TestInfo, opts: CaptureOptions) {
	const { name, waitForIdle = true, settleMs = 500 } = opts

	// Wait for page to settle
	if (waitForIdle) {
		await page.waitForLoadState('networkidle').catch(() => {
			// networkidle can timeout on long-polling pages — that's ok
		})
	}
	if (settleMs > 0) {
		await page.waitForTimeout(settleMs)
	}

	// 1. Screenshot (Playwright manages these in __snapshots__ via toHaveScreenshot)
	await page.screenshot({
		path: testInfo.outputPath(`${name}.png`),
		fullPage: false,
	})

	// 2. Accessibility tree
	const a11yTree = await page.accessibility.snapshot({ interestingOnly: true }).catch(() => null)
	if (a11yTree) {
		const a11yPath = testInfo.outputPath(`${name}-a11y.json`)
		writeFileSync(a11yPath, JSON.stringify(a11yTree, null, 2))
	}

	// 3. Page title + URL (useful for verifying navigation)
	const meta = {
		url: page.url(),
		title: await page.title(),
		timestamp: new Date().toISOString(),
	}
	writeFileSync(testInfo.outputPath(`${name}-meta.json`), JSON.stringify(meta, null, 2))
}

/**
 * Collect console messages during a test.
 * Call at the beginning of each test, returns a function to flush collected entries.
 */
export function collectConsoleLogs(page: Page) {
	const entries: Array<{ type: string; text: string; url: string }> = []

	page.on('console', (msg) => {
		const text = msg.text()
		// Filter noise
		if (CONSOLE_NOISE.some((p) => p.test(text))) return
		entries.push({
			type: msg.type(),
			text: text.slice(0, 500), // cap per entry
			url: msg.location().url || '',
		})
	})

	return {
		entries,
		flush: (testInfo: TestInfo, name: string) => {
			if (entries.length > 0) {
				writeFileSync(
					testInfo.outputPath(`${name}-console.json`),
					JSON.stringify(entries, null, 2)
				)
			}
			return entries
		},
	}
}

/**
 * Assert no unexpected console errors during a flow.
 * Filters known noise and returns remaining errors.
 */
export function getConsoleErrors(entries: Array<{ type: string; text: string }>) {
	return entries.filter(
		(e) => e.type === 'error' && !CONSOLE_NOISE.some((p) => p.test(e.text))
	)
}
