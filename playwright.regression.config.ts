/**
 * Lightweight Playwright config for regression specs that don't need harness auth.
 *
 * Difference from playwright.config.ts:
 *   - No globalSetup (skips the `/dev/test-session` hit on the API — so these
 *     specs run even when TEST_HARNESS_SECRET + ENABLE_TEST_ROUTES aren't set)
 *   - No pre-loaded storageState
 *   - Same webServer reuse (assume UI is already running at :3050)
 *   - Only picks up *.regression.spec.ts files + icon-regression.spec.ts
 *
 * Usage:
 *   UI_BASE_URL=http://localhost:3050 npx playwright test --config=playwright.regression.config.ts
 */

import { defineConfig, devices } from '@playwright/test'

const UI_BASE = process.env.UI_BASE_URL || 'http://localhost:3000'

export default defineConfig({
    testDir: './e2e/flows',
    testMatch: ['**/icon-regression.spec.ts', '**/send-link-e2e.spec.ts', '**/*.regression.spec.ts'],
    outputDir: './e2e/__results__',

    fullyParallel: false,
    workers: 1,
    retries: 1,
    timeout: 60_000,
    expect: { timeout: 10_000 },

    reporter: [['list']],

    use: {
        baseURL: UI_BASE,
        trace: 'retain-on-failure',
        screenshot: 'off',
    },

    projects: [
        {
            name: 'mobile',
            use: {
                ...devices['Pixel 7'],
                viewport: { width: 390, height: 844 },
                isMobile: true,
                hasTouch: true,
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
