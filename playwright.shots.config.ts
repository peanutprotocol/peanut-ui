/**
 * Visual-shot capture: every fixture in src/dev/fixtures/registry.ts, at four
 * widths, one PNG each.
 *
 * Usage:
 *   npm run test:visual                       # build, then capture
 *   SHOTS_OUT=e2e/__shots__/before npm run test:visual
 *   npm run test:visual:capture               # capture again, no rebuild
 *   npm run test:visual:diff before after     # compare two capture dirs
 *
 * Runs against `next start`, never `next dev --turbo`: Turbopack + Playwright
 * Chromium breaks React hydration here and every page hangs on the loading
 * mascot. The build needs NEXT_PUBLIC_VERCEL_ENV=preview or DEV_TOOLS_ENABLED
 * is false, the fixture is ignored, and every screen redirects to /setup.
 *
 * No globalSetup and no API. A fixture answers every request and writes the
 * jwt-token cookie itself, so there is no auth step to run.
 */

import { defineConfig, devices } from '@playwright/test'

// 320 is an iPhone SE / a Pro on Larger Text and finds the most overflow bugs.
// 430 is a Pro Max. Heights are the real device heights for each width.
const WIDTHS = [
    { width: 320, height: 568 },
    { width: 375, height: 667 },
    { width: 393, height: 852 },
    { width: 430, height: 932 },
]

// 3080-3089 only: other sessions own 3050, 3060 and 5050.
const PORT = Number(process.env.SHOTS_PORT ?? 3080)
const BASE = `http://127.0.0.1:${PORT}`

export default defineConfig({
    testDir: './e2e/shots',
    outputDir: './e2e/__results__',

    // Fixtures share no state, so every page is independent.
    fullyParallel: true,
    workers: process.env.CI ? 2 : 4,
    retries: 0,
    timeout: 60_000,
    expect: { timeout: 15_000 },

    reporter: [['list']],

    use: {
        baseURL: BASE,
        trace: 'off',
        video: 'off',
        screenshot: 'off',
        // The serwist worker caches responses across runs, which makes the
        // second capture of the same commit differ from the first.
        serviceWorkers: 'block',
        // Deterministic rendering: no device-pixel-ratio surprises, no OS
        // scrollbars in the frame, one fixed locale and timezone.
        deviceScaleFactor: 1,
        isMobile: true,
        hasTouch: true,
        // Peanut is a mobile-first PWA and sniffs the user agent in places. The
        // default headless UA takes desktop branches. Pixel 7 matches the two
        // existing Playwright configs; only the string is borrowed, the viewport
        // and pixel ratio stay as set here.
        userAgent: devices['Pixel 7'].userAgent,
        locale: 'en-US',
        timezoneId: 'UTC',
        colorScheme: 'light',
    },

    projects: WIDTHS.map(({ width, height }) => ({
        name: String(width),
        use: { viewport: { width, height } },
    })),

    webServer: {
        command: `npx next start -p ${PORT}`,
        url: BASE,
        reuseExistingServer: true,
        timeout: 120_000,
    },
})
