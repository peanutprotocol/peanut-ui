/**
 * The behaviour specs in e2e/flows: what a screen does, not how it looks.
 * Looks are covered by playwright.shots.config.ts.
 *
 * Every spec here asserts, needs no API and needs no login. There is no
 * globalSetup and no storageState — the old ones called /dev/test-session with
 * TEST_HARNESS_SECRET, which nobody had, so nothing ran for months.
 *
 * Runs against `next start`, like the shot capture: /dev pages need
 * NEXT_PUBLIC_VERCEL_ENV=preview at build time or DEV_TOOLS_ENABLED is false.
 *
 *   NEXT_PUBLIC_VERCEL_ENV=preview npm run build
 *   npm run test:e2e:regression
 *
 * Anything that needs a real backend, provider or chain belongs in the
 * Nutcracker harness in mono, not here.
 */

import { defineConfig, devices } from '@playwright/test'

// 3080-3089 only: other sessions own 3050, 3060 and 5050.
const PORT = Number(process.env.REGRESSION_PORT ?? 3081)
const BASE = `http://127.0.0.1:${PORT}`

export default defineConfig({
    testDir: './e2e/flows',
    outputDir: './e2e/__results__',

    fullyParallel: true,
    workers: process.env.CI ? 2 : 4,
    retries: 1,
    timeout: 90_000,
    expect: { timeout: 10_000 },

    reporter: [['list']],

    use: {
        baseURL: BASE,
        trace: 'retain-on-failure',
        video: 'off',
        screenshot: 'off',
        // The serwist worker serves cached responses from an earlier run.
        serviceWorkers: 'block',
        ...devices['Pixel 7'],
        viewport: { width: 390, height: 844 },
    },

    projects: [{ name: 'mobile' }],

    webServer: {
        command: `npx next start -p ${PORT}`,
        url: BASE,
        // Locally, adopting a running server is the fast path. In CI it would
        // silently adopt a stale `next start` from an earlier step and run
        // against the wrong build.
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
    },
})
