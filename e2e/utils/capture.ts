/**
 * Capture utilities for the verification harness.
 *
 * At each step: screenshot + page metadata + console logs.
 */

import { Page, TestInfo } from '@playwright/test'
import { writeFileSync } from 'fs'

export interface CaptureOptions {
	name: string
	waitForIdle?: boolean
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
	/Lit is in dev mode/,
]

/**
 * Capture a behavioral snapshot at the current page state.
 */
export async function captureStep(page: Page, testInfo: TestInfo, opts: CaptureOptions) {
	const { name, waitForIdle = true, settleMs = 500 } = opts

	if (waitForIdle) {
		await page.waitForLoadState('networkidle').catch(() => {})
	}
	if (settleMs > 0) {
		await page.waitForTimeout(settleMs)
	}

	// Screenshot
	try {
		await page.screenshot({
			path: testInfo.outputPath(`${name}.png`),
			fullPage: false,
		})
	} catch (e) {
		// Page might have navigated away — capture what we can
	}

	// Page metadata (URL + title + visible text summary)
	try {
		const meta = {
			url: page.url(),
			title: await page.title().catch(() => ''),
			timestamp: new Date().toISOString(),
			viewport: page.viewportSize(),
		}
		writeFileSync(testInfo.outputPath(`${name}-meta.json`), JSON.stringify(meta, null, 2))
	} catch (e) {
		// Non-critical
	}

	// Aria snapshot (Playwright 1.58+ uses ariaSnapshot on locator)
	try {
		const ariaText = await page.locator('body').ariaSnapshot().catch(() => null)
		if (ariaText) {
			writeFileSync(testInfo.outputPath(`${name}-aria.txt`), ariaText)
		}
	} catch {
		// Aria API may not be available — skip
	}
}

/**
 * Collect console messages during a test.
 */
export function collectConsoleLogs(page: Page) {
	const entries: Array<{ type: string; text: string }> = []

	page.on('console', (msg) => {
		const text = msg.text()
		if (CONSOLE_NOISE.some((p) => p.test(text))) return
		entries.push({ type: msg.type(), text: text.slice(0, 500) })
	})

	return {
		entries,
		flush: (testInfo: TestInfo, name: string) => {
			if (entries.length > 0) {
				try {
					writeFileSync(
						testInfo.outputPath(`${name}-console.json`),
						JSON.stringify(entries, null, 2)
					)
				} catch {}
			}
			return entries
		},
	}
}

export function getConsoleErrors(entries: Array<{ type: string; text: string }>) {
	return entries.filter(
		(e) => e.type === 'error' && !CONSOLE_NOISE.some((p) => p.test(e.text))
	)
}
