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

type Capture = {
    id: string
    name: string
    route: string
    /** Fixture to serve this capture. Defaults to FIXTURE (the demo baseline). */
    fixture?: string
    /** Accessible names clicked in order before the shot. */
    clicks?: string[]
    /** Scroll to the bottom first — some notifications sit below the fold. */
    toBottom?: boolean
}

const CAPTURES: Capture[] = [
    // The page you flagged, then each of its three inline FAQ sheets.
    { id: 'p01-backup', name: 'Backup', route: '/profile/backup' },
    {
        id: 'p02-backup-lose-phone',
        name: 'Backup — What if I lose my phone?',
        route: '/profile/backup',
        clicks: ['What if I lose my phone?'],
    },
    {
        id: 'p03-backup-change-phone',
        name: 'Backup — What if I change phone?',
        route: '/profile/backup',
        clicks: ['What if I change phone?'],
    },
    {
        id: 'p04-backup-export-keys',
        name: 'Backup — Why can’t I export my private key?',
        route: '/profile/backup',
        clicks: ["Why can't I export my private key?"],
    },

    { id: 'p05-home', name: 'Home', route: '/home' },
    { id: 'p06-profile', name: 'Profile', route: '/profile' },
    { id: 'p07-profile-edit', name: 'Profile — edit', route: '/profile/edit' },
    { id: 'p08-profile-view', name: 'Profile — public view', route: '/profile/view' },
    { id: 'p09-profile-about', name: 'Profile — about', route: '/profile/about' },
    { id: 'p10-exchange-rate', name: 'Exchange rate', route: '/profile/exchange-rate' },

    { id: 'p11-identity-verification', name: 'Identity verification', route: '/profile/identity-verification' },
    {
        id: 'p12-identity-additional',
        name: 'Identity — additional',
        route: '/profile/identity-verification/additional',
    },
    { id: 'p13-limits', name: 'Limits', route: '/limits' },

    { id: 'p14-withdraw', name: 'Withdraw', route: '/withdraw' },
    { id: 'p15-withdraw-crypto', name: 'Withdraw — crypto', route: '/withdraw/crypto' },
    { id: 'p16-withdraw-manteca', name: 'Withdraw — Manteca', route: '/withdraw/manteca' },
    { id: 'p17-add-money', name: 'Add money', route: '/add-money' },
    { id: 'p18-add-money-crypto', name: 'Add money — crypto', route: '/add-money/crypto' },
    { id: 'p19-add-money-us-bank', name: 'Add money — US bank', route: '/add-money/us/bank' },

    { id: 'p20-qr-pay', name: 'QR Pay', route: '/qr-pay' },
    { id: 'p21-qr', name: 'QR', route: '/qr' },
    { id: 'p22-card', name: 'Card', route: '/card' },
    { id: 'p23-card-limit', name: 'Card — limit', route: '/card/limit' },
    { id: 'p24-card-pin', name: 'Card — PIN', route: '/card/pin' },
    { id: 'p25-card-recovery', name: 'Card recovery', route: '/card-recovery' },

    { id: 'p26-recover-funds', name: 'Recover funds', route: '/recover-funds' },
    { id: 'p27-recover-wallet', name: 'Recover wallet', route: '/recover-wallet' },
    { id: 'p28-history', name: 'History', route: '/history' },
    { id: 'p29-badges', name: 'Badges', route: '/badges' },
    { id: 'p30-points', name: 'Points', route: '/points' },
    { id: 'p31-send', name: 'Send', route: '/send' },
    { id: 'p32-request', name: 'Request', route: '/request' },
    { id: 'p33-claim', name: 'Claim', route: '/claim' },
    { id: 'p34-language', name: 'Language', route: '/settings/language' },
    { id: 'p35-home-ctas', name: 'Home CTAs (incl. spend chooser)', route: '/dev/home-ctas' },

    // Screens the demo baseline gates out; each has a fixture that opens it.
    {
        id: 'p36-add-money-bank-list',
        name: 'Add money — bank country list',
        route: '/add-money?method=bank',
        fixture: 'add-money',
    },
    {
        id: 'p37-add-money-crypto',
        name: 'Add money — network picker',
        route: '/add-money/crypto',
        fixture: 'add-money-crypto',
    },
    {
        id: 'p38-kyc-action-required',
        name: 'Identity — action required',
        route: '/profile/identity-verification',
        fixture: 'kyc-action-required',
    },
    { id: 'p39-language', name: 'Language', route: '/settings/language', fixture: 'settings-language' },
    { id: 'p40-withdraw', name: 'Withdraw — saved accounts', route: '/withdraw', fixture: 'withdraw' },
]

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
    test(capture.id, async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 900 })

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
            path: join(OUT_DIR, `${capture.id}.png`),
            animations: 'disabled',
            caret: 'hide',
            scale: 'css',
        })
        await writeFile(
            join(OUT_DIR, `${capture.id}.json`),
            JSON.stringify({ ...capture, landed, notes, ok: notes.length === 0 }, null, 2)
        )
    })
}
