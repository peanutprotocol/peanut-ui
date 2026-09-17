/**
 * One PNG per app ROUTE, and per modal that only exists inside one.
 *
 * src/dev/surfaces/registry.tsx can only mount a surface that takes an
 * open/visible prop. The overlays declared inline in a page — the three Backup
 * FAQ sheets, the qr-pay KYC branches, the delete-account sequence — have no
 * such prop, and neither do the `Notification` blocks that sit in a screen
 * rather than in an overlay. Those are reachable only by loading the real route
 * and, where needed, clicking the thing that opens them.
 *
 * Writes `<PAGES_OUT>/<id>.png` plus `<id>.json` recording the URL that was
 * actually shot and whether every click landed, so a page that redirected or a
 * row that moved shows up as a note instead of a mislabelled picture.
 *
 *   pnpm exec playwright test --config=playwright.shots.config.ts \
 *     --project=375 e2e/shots/pages.spec.ts
 */

import { expect, test } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { FIXTURE_STORAGE_KEY } from '../../src/dev/fixtures/active'

const OUT_DIR = process.env.PAGES_OUT ?? 'e2e/__shots__/pages'
const FIXTURE = 'profile-edit'
const FROZEN_NOW = new Date('2026-08-15T12:00:00.000Z')

import { PAGE_CAPTURES as CAPTURES } from '../../src/dev/screens/pages'

function seenOnceModals(): void {
    window.sessionStorage.setItem('showNoMoreJailModal', 'true')
    window.localStorage.setItem('peanut_demo_activation_celebrated_at', '2026-01-01T00:00:00.000Z')
    window.localStorage.setItem(
        'demo-user:user-preferences',
        JSON.stringify({ hasSeenBalanceWarning: { value: true, expiry: 4102444800000 } })
    )
}

const FREEZE_CSS = `
*, *::before, *::after {
    animation: none !important;
    transition: none !important;
    caret-color: transparent !important;
    scroll-behavior: auto !important;
}
a[href*="__fixture=off"] { display: none !important; }
`

const LOADERS = '.animate-spin img[alt="Peanut mascot"], .animate-pulse'

test.describe.configure({ mode: 'parallel' })

for (const capture of CAPTURES) {
    test(capture.id, async ({ page }, testInfo) => {
        await page.route('**/*', (route) => {
            const { hostname } = new URL(route.request().url())
            return hostname === '127.0.0.1' || hostname === 'localhost' ? route.continue() : route.abort()
        })
        await page.clock.setFixedTime(FROZEN_NOW)
        await page.addInitScript(seenOnceModals)

        const fixture = capture.fixture ?? FIXTURE
        const separator = capture.route.includes('?') ? '&' : '?'
        await page.goto(`${capture.route}${separator}__fixture=${fixture}`, { waitUntil: 'domcontentloaded' })

        await expect
            .poll(() => page.evaluate((key) => window.sessionStorage.getItem(key), FIXTURE_STORAGE_KEY), {
                message: 'fixture mode never engaged — is this a NEXT_PUBLIC_VERCEL_ENV=preview build?',
            })
            .toBe(fixture)

        await page.waitForTimeout(900)
        await page
            .waitForFunction(
                (selector) =>
                    Array.from(document.querySelectorAll(selector)).every((el) => {
                        const box = el.getBoundingClientRect()
                        return box.width === 0 || box.bottom <= 0 || box.top >= window.innerHeight
                    }),
                LOADERS,
                { timeout: 10_000 }
            )
            .catch(() => undefined)

        const notes: string[] = []
        for (const label of capture.clicks ?? []) {
            const target = page.getByText(label, { exact: false }).first()
            try {
                await target.click({ timeout: 8_000 })
                await page.waitForTimeout(700)
            } catch {
                notes.push(`could not click “${label}”`)
            }
        }

        if (capture.toBottom) {
            await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
            await page.waitForTimeout(400)
        }

        const landed = new URL(page.url()).pathname
        // A route that bounced (unmet gate, missing fixture data) is still worth
        // shooting — as long as the manifest says it is not the route we asked for.
        const asked = capture.route.split('?')[0]
        if (landed !== asked) notes.push(`redirected to ${landed}`)

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
            path: join(OUT_DIR, `${capture.id}@${testInfo.project.name}.png`),
            animations: 'disabled',
            caret: 'hide',
            scale: 'css',
        })
        await writeFile(
            join(OUT_DIR, `${capture.id}@${testInfo.project.name}.json`),
            JSON.stringify({ ...capture, landed, notes, ok: notes.length === 0 }, null, 2)
        )
    })
}
