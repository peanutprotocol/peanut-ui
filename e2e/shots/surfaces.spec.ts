/**
 * One PNG per surface in src/dev/surfaces/registry.tsx, written to
 * `<SURFACES_OUT>/<id>.png` at 375x900 — the width the content-taxonomy
 * artifacts were rendered at.
 *
 * Runs through playwright.shots.config.ts (see the header there): a production
 * build with NEXT_PUBLIC_VERCEL_ENV=preview, served by `next start`, with the
 * API faked by fixture mode so the signed-in surfaces have a session.
 *
 *   SURFACES_ONLY=1 pnpm exec playwright test --config=playwright.shots.config.ts \
 *     --project=375 e2e/shots/surfaces.spec.ts
 */

import { expect, test } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { FIXTURE_STORAGE_KEY } from '../../src/dev/fixtures/active'
import { SURFACE_META } from '../../src/dev/surfaces/list'

const OUT_DIR = process.env.SURFACES_OUT ?? 'e2e/__shots__/surfaces'

// Any fixture activates fixture mode; the demo baseline underneath it is a
// verified user with a balance and working rails, which is what these surfaces
// want. The route the fixture names is irrelevant here — we navigate ourselves.
const FIXTURE = 'profile-edit'

const FROZEN_NOW = new Date('2026-08-15T12:00:00.000Z')

const FREEZE_CSS = `
*, *::before, *::after {
    animation: none !important;
    transition: none !important;
    caret-color: transparent !important;
    scroll-behavior: auto !important;
}
/* the harness's own fixture banner is chrome, not the surface */
a[href*="__fixture=off"] { display: none !important; }
`

// The mascot spinner and the grey skeleton rows are what the app shows while it
// waits. A surface still showing one is a picture of a loader, so give it a
// bounded chance to resolve before shooting anyway — some of these want an
// endpoint no fixture serves, and a loader is the honest render for those.
const LOADERS = '.animate-spin img[alt="Peanut mascot"], .animate-pulse'

test.describe.configure({ mode: 'parallel' })

for (const [id, surface] of Object.entries(SURFACE_META)) {
    test(id, async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 900 })

        // Third-party beacons add network races and nothing visible.
        await page.route('**/*', (route) => {
            const { hostname } = new URL(route.request().url())
            return hostname === '127.0.0.1' || hostname === 'localhost' ? route.continue() : route.abort()
        })
        await page.clock.setFixedTime(FROZEN_NOW)

        await page.goto(`/dev/surfaces?s=${id}&__fixture=${FIXTURE}`, { waitUntil: 'domcontentloaded' })

        // Prove fixture mode engaged — without it a protected surface bounces to
        // /setup and we would happily shoot 65 pictures of the wrong screen.
        await expect
            .poll(() => page.evaluate((key) => window.sessionStorage.getItem(key), FIXTURE_STORAGE_KEY), {
                message: 'fixture mode never engaged — is this a NEXT_PUBLIC_VERCEL_ENV=preview build?',
            })
            .toBe(FIXTURE)

        // Radix/vaul mount their portals a frame after open; the freeze stylesheet
        // has to land after that or the drawer slides during the shot.
        await page.waitForTimeout(600)
        await page
            .waitForFunction(
                (selector) =>
                    Array.from(document.querySelectorAll(selector)).every((el) => {
                        const box = el.getBoundingClientRect()
                        return box.width === 0 || box.bottom <= 0 || box.top >= window.innerHeight
                    }),
                LOADERS,
                { timeout: 8_000 }
            )
            .catch(() => undefined)
        await page.addStyleTag({ content: FREEZE_CSS })
        await page.evaluate(() => document.fonts.ready.then(() => undefined))
        await page.waitForFunction(() =>
            Array.from(document.images).every((img) => {
                const box = img.getBoundingClientRect()
                const offscreen = box.width === 0 || box.bottom <= 0 || box.top >= window.innerHeight
                return offscreen || img.complete
            })
        )

        await mkdir(OUT_DIR, { recursive: true })
        await page.screenshot({
            path: join(OUT_DIR, `${id}.png`),
            animations: 'disabled',
            caret: 'hide',
            scale: 'css',
        })

        expect(surface.name).toBeTruthy()
    })
}
