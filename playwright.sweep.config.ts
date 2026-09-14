/**
 * Full i18n overflow sweep (TASK-22366 follow-up): every surface × every
 * supported locale × the four device widths. This is the on-demand /
 * nightly matrix — the per-PR gate (playwright.overflow.config.ts) stays
 * small on purpose. Hugo's framing: window-size simulation + language
 * simulation, no manual testing.
 *
 * Projects are the WIDTHS; the spec varies locale per describe block, so
 * one project run covers all four locales at that width. Each test writes
 * one JSON line into SWEEP_OUT; scripts/overflow-sweep-report.mjs folds
 * them into sweep-report.json.
 *
 *   npm run test:i18n-overflow:sweep         # build, run matrix, report
 *   npm run test:i18n-overflow:sweep:run     # no rebuild
 */

import { defineConfig } from '@playwright/test'
import base from './playwright.shots.config'

const WIDTHS = [
    { width: 320, height: 568 },
    { width: 375, height: 667 },
    { width: 393, height: 852 },
    { width: 430, height: 932 },
]

export default defineConfig({
    ...base,
    // ~2k page loads: give it more headroom than the gate but stay honest
    // about failure — no retries, a flaky page is a finding.
    timeout: 90_000,
    projects: WIDTHS.map(({ width, height }) => ({
        name: `w${width}`,
        testMatch: /overflow-sweep\.spec\.ts/,
        use: {
            ...base.use,
            viewport: { width, height },
        },
    })),
})
