/**
 * One PNG per fixture per width, written to `<SHOTS_OUT>/<name>@<width>.png`.
 *
 * The flat name is a contract: scripts/visual-diff.mjs pairs two capture
 * directories by filename. The registry test already pins fixture names to
 * unique kebab-case, so the names are safe as filenames.
 *
 * Run through playwright.shots.config.ts — see the header there.
 */

import { expect, test, type Page } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { FIXTURE_PARAM, FIXTURE_STORAGE_KEY } from '../../src/dev/fixtures/active'
import { FIXTURES } from '../../src/dev/fixtures/registry'

const OUT_DIR = process.env.SHOTS_OUT ?? 'e2e/__shots__/current'

// A frozen date keeps anything derived from "now" — relative times, greetings,
// expiry countdowns — identical between a baseline taken last week and a
// capture taken today. setFixedTime freezes Date only; timers still run.
// Must stay LATER than every timestamp in the fixture registry (newest:
// 2026-08-01), or relative times render as nonsense like "in 2 months".
const FROZEN_NOW = new Date('2026-08-15T12:00:00.000Z')

// The two things the app shows while it waits: the mascot from
// components/Global/Loading (variant="mascot") and the grey `animate-pulse`
// skeleton rows. A run that captures 120 loaders looks exactly like a run that
// captured 120 screens, so the wait below fails the test instead of shooting
// one.
//
// Only loaders inside the viewport count. Home keeps a mascot far below the
// fold that never resolves without a live backend; it is off-camera, so it is
// not a screenshot problem.
const LOADERS = '.animate-spin img[alt="Peanut mascot"], .animate-pulse'

// Kills everything that moves between two identical runs. `animations:
// 'disabled'` in the screenshot call only rewinds CSS animations; framer-motion
// drives inline transitions from JS, so those need the stylesheet too.
const FREEZE_CSS = `
*, *::before, *::after {
    animation: none !important;
    transition: none !important;
    caret-color: transparent !important;
    scroll-behavior: auto !important;
}
`

// Two one-time modals cover every /home fixture on a first visit — the
// high-balance warning and the "You're unlocked" celebration. Left alone they
// hide the state under test behind the same two dialogs on eight screens.
// Both are localStorage-gated, so marking them seen shoots a returning user,
// which is the state worth watching for regressions.
//
// Keys: demo-api stamps the celebration itself; user preferences hang off
// `demo-user`, the id every fixture inherits from demo-api.
function seenOnceModals(): void {
    window.localStorage.setItem('peanut_demo_activation_celebrated_at', '2026-01-01T00:00:00.000Z')
    window.localStorage.setItem(
        'demo-user:user-preferences',
        JSON.stringify({ hasSeenBalanceWarning: { value: true, expiry: 4102444800000 } })
    )
    // useGeoLocation fetches ipapi.co (an external host) when its cache is
    // cold, and /add-money's country list sits behind that spinner — in CI the
    // request can hang past the test timeout. Seed the sessionStorage cache so
    // the hook never fetches; timestamp sits just before FROZEN_NOW.
    window.sessionStorage.setItem('user_geo_country_code', 'DE')
    window.sessionStorage.setItem(
        'user_geo_country_code_timestamp',
        String(new Date('2026-08-15T11:59:00.000Z').getTime())
    )
}

async function settle(page: Page): Promise<void> {
    await page.waitForFunction((selector) => {
        const { innerHeight, innerWidth } = window
        return Array.from(document.querySelectorAll(selector)).every((el) => {
            const box = el.getBoundingClientRect()
            return (
                box.width === 0 || box.bottom <= 0 || box.top >= innerHeight || box.right <= 0 || box.left >= innerWidth
            )
        })
    }, LOADERS)
    await page.addStyleTag({ content: FREEZE_CSS })
    await page.evaluate(() => document.fonts.ready.then(() => undefined))
    // next/image decodes lazily; an image that lands after the shot is the
    // classic one-pixel-different rerun.
    await page.waitForFunction(() => Array.from(document.images).every((img) => img.complete))

    // Text that a script drives frame by frame — /rewards counts the points
    // total up over 1.5s — ignores the stylesheet above, so wait for two equal
    // samples instead of guessing a delay.
    await page.waitForFunction(
        () => {
            const seen = window as unknown as { __shotText?: string }
            const text = document.body.innerText
            if (seen.__shotText === text) return true
            seen.__shotText = text
            return false
        },
        null,
        { polling: 250 }
    )
}

test.describe.configure({ mode: 'parallel' })

for (const [name, fixture] of Object.entries(FIXTURES)) {
    test(name, async ({ page }, testInfo) => {
        // The project name is the width — see playwright.shots.config.ts.
        const width = testInfo.project.name

        // Third-party beacons (PostHog, Sentry, OneSignal) add network races and
        // nothing visible. The app itself is same-origin; the API is faked.
        await page.route('**/*', (route) => {
            const { hostname } = new URL(route.request().url())
            return hostname === '127.0.0.1' || hostname === 'localhost' ? route.continue() : route.abort()
        })
        await page.clock.setFixedTime(FROZEN_NOW)
        await page.addInitScript(seenOnceModals)

        await page.goto(`${fixture.route}?${FIXTURE_PARAM}=${name}`, { waitUntil: 'domcontentloaded' })
        await settle(page)

        // A build without NEXT_PUBLIC_VERCEL_ENV=preview ignores the param and
        // bounces every protected route to /setup — which settles fine, so the
        // run would happily write 120 screenshots of /setup under fixture
        // filenames. Prove fixture mode really engaged: the app promotes the
        // URL param into sessionStorage on its first faked API call.
        await expect
            .poll(() => page.evaluate((key) => window.sessionStorage.getItem(key), FIXTURE_STORAGE_KEY), {
                message: `fixture mode never engaged — is this a NEXT_PUBLIC_VERCEL_ENV=preview build?`,
            })
            .toBe(name)

        await mkdir(OUT_DIR, { recursive: true })
        await page.screenshot({
            path: join(OUT_DIR, `${name}@${width}.png`),
            animations: 'disabled',
            caret: 'hide',
            scale: 'css',
        })
    })
}
