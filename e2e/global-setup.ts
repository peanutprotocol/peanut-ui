/**
 * Playwright global setup: authenticate via /dev/test-session.
 *
 * Hits the API's test-session endpoint to get a JWT, then creates a
 * browser context with that token set as a cookie/localStorage entry
 * (matching how the real auth flow stores it), and saves the storage
 * state for all tests to reuse.
 *
 * Requirements:
 *   - API running at API_BASE_URL (default http://localhost:5001)
 *   - ENABLE_TEST_ROUTES=true on the API
 *   - TEST_HARNESS_SECRET set on the API
 */

import { chromium, FullConfig } from '@playwright/test'

const API_BASE = process.env.API_BASE_URL || 'http://localhost:5001'
const UI_BASE = process.env.UI_BASE_URL || 'http://localhost:3000'
const HARNESS_SECRET = process.env.TEST_HARNESS_SECRET || 'local-harness-secret-must-be-at-least-32-characters-long'
const TEST_EMAIL = process.env.TEST_USER_EMAIL || `harness-e2e-${Date.now()}@test.local`

export default async function globalSetup(config: FullConfig) {
	console.log('[global-setup] Authenticating via /dev/test-session...')

	// 1. Get a JWT from the API
	const res = await fetch(`${API_BASE}/dev/test-session`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'x-test-harness-secret': HARNESS_SECRET,
		},
		body: JSON.stringify({
			email: TEST_EMAIL,
			kyc: 'verified',
			country: 'AR',
			harnessLabel: 'playwright',
		}),
	})

	if (!res.ok) {
		const body = await res.text()
		throw new Error(
			`[global-setup] /dev/test-session returned ${res.status}: ${body}\n` +
			`Make sure the API is running at ${API_BASE} with ENABLE_TEST_ROUTES=true and TEST_HARNESS_SECRET set.`
		)
	}

	const { token, user } = await res.json() as { token: string; user: { userId: string; email: string } }
	console.log(`[global-setup] Authenticated as ${user.email} (${user.userId})`)

	// 2. Create a browser context and inject the auth state
	// The peanut-ui app stores the JWT in a cookie named 'token' (httpOnly: false per tech debt audit)
	// and also checks localStorage for user session data.
	const browser = await chromium.launch()
	const context = await browser.newContext()

	// Set the JWT cookie for the UI domain
	await context.addCookies([
		{
			name: 'token',
			value: token,
			domain: new URL(UI_BASE).hostname,
			path: '/',
			httpOnly: false,
			secure: false,
			sameSite: 'Lax',
		},
	])

	// Navigate to the app once to let it hydrate and store any additional session data
	const page = await context.newPage()
	try {
		await page.goto(UI_BASE, { waitUntil: 'domcontentloaded', timeout: 30_000 })
		// Give the app a moment to set up localStorage/context from the cookie
		await page.waitForTimeout(2000)
	} catch (e) {
		console.warn(`[global-setup] Warning: could not navigate to ${UI_BASE} — ${(e as Error).message}`)
		console.warn('[global-setup] Tests may fail if the UI dev server is not running.')
	}

	// 3. Save storage state (cookies + localStorage) for all tests
	await context.storageState({ path: './e2e/.auth/storage-state.json' })
	console.log('[global-setup] Storage state saved to e2e/.auth/storage-state.json')

	await browser.close()

	// Export user info for tests to reference
	process.env.TEST_USER_ID = user.userId
	process.env.TEST_USER_EMAIL = user.email
}
