import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright E2E Test Configuration
 *
 * Testing philosophy:
 * - Test navigation flows and UI logic without external dependencies
 * - Do NOT test payment/KYC/bank flows (manual QA required)
 * - Fast, reliable tests for core user journeys
 *
 * See docs/TESTING.md for full testing philosophy
 */
export default defineConfig({
    // test directory lives with code (per .cursorrules)
    testDir: './src',
    testMatch: '**/*.e2e.test.ts',

    // reasonable timeout for UI tests
    timeout: 30 * 1000,

    // fail fast in CI
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,

    // clear, concise reporting
    reporter: 'html',

    use: {
        // base url for tests
        baseURL: 'http://localhost:3000',
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
    },

    // test against chromium only (simplest, fastest)
    // can expand to firefox/webkit if cross-browser bugs emerge
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],

    // start dev server before tests
    webServer: {
        command: 'npm run dev',
        url: 'http://localhost:3000',
        reuseExistingServer: !process.env.CI,
        timeout: 120 * 1000, // 2 minutes for dev server startup
    },
})
