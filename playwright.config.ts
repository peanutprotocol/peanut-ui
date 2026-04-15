import { defineConfig, devices } from '@playwright/test'

/**
 * De-Complexify UI Verification Harness.
 *
 * Captures screenshots + a11y tree + network HAR + console logs for core flows.
 * Used to verify M2 refactors (Redux kill, MUI kill, flow context consolidation)
 * don't break observable UI behavior.
 *
 * Usage:
 *   # Start API + UI dev servers first, then:
 *   npx playwright test                        # all flows, all viewports
 *   npx playwright test e2e/flows/home.spec.ts  # single flow
 *   npx playwright test --project=mobile        # mobile only
 *
 * Auth: global-setup.ts hits /dev/test-session on the API to get a JWT,
 * saved as storageState so all tests are pre-authenticated (skips passkey).
 */

const API_BASE = process.env.API_BASE_URL || 'http://localhost:5000'
const UI_BASE = process.env.UI_BASE_URL || 'http://localhost:3000'

export default defineConfig({
	testDir: './e2e/flows',
	outputDir: './e2e/__results__',

	snapshotDir: './e2e/__snapshots__',
	snapshotPathTemplate: '{snapshotDir}/{testFilePath}/{arg}-{projectName}{ext}',

	/* Serial — flows depend on seeded state */
	fullyParallel: false,
	workers: 1,

	retries: 1,

	/* Generous timeout — dev server + mobile compilation can be slow */
	timeout: 120_000,
	expect: {
		timeout: 15_000,
		toHaveScreenshot: {
			maxDiffPixelRatio: 0.01,
		},
	},

	globalSetup: './e2e/global-setup.ts',

	reporter: [
		['html', { open: 'never', outputFolder: './e2e/__report__' }],
		['list'],
	],

	use: {
		baseURL: UI_BASE,
		storageState: './e2e/.auth/storage-state.json',
		trace: 'retain-on-failure',
		video: 'off',
		screenshot: 'off', // manual screenshots at each step
	},

	projects: [
		// Mobile first — Peanut is a mobile-first PWA.
		// Uses Chromium with mobile viewport + mobile user agent so we get
		// mobile rendering without needing WebKit system deps.
		{
			name: 'mobile',
			use: {
				...devices['Pixel 7'],
				viewport: { width: 390, height: 844 },
				isMobile: true,
				hasTouch: true,
			},
		},
		{
			name: 'desktop',
			use: {
				viewport: { width: 1440, height: 900 },
			},
		},
	],

	webServer: {
		command: 'npm run dev',
		url: UI_BASE,
		reuseExistingServer: true,
		timeout: 120_000,
	},
})
