/**
 * Full i18n overflow sweep (TASK-22366 follow-up). Matrix:
 *  - app fixtures + overlays + setup: 4 locales × 4 widths
 *  - marketing/landing: every slug × 4 URL locales at 320, template
 *    representatives at all widths (sweep-targets.ts)
 *
 * Every executed cell writes one JSON line into SWEEP_OUT (default
 * e2e/__sweep__): {id, kind, width, locale, status, overflows|reason}.
 * A cell whose coverage collapsed (redirect, click miss) records status
 * "skip" with the reason instead of silently passing — the aggregator
 * (scripts/overflow-sweep-report.mjs) surfaces both.
 *
 * Run through playwright.sweep.config.ts.
 */

import { expect, test, type Page, type TestInfo } from '@playwright/test'
import { appendFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { FIXTURE_STORAGE_KEY, fixtureHref } from '../../src/dev/fixtures/active'
import { FIXTURES } from '../../src/dev/fixtures/registry'
import en from '../../src/i18n/app/messages/en.json'
import es419 from '../../src/i18n/app/messages/es-419.json'
import esAR from '../../src/i18n/app/messages/es-AR.json'
import ptBR from '../../src/i18n/app/messages/pt-BR.json'
import { findOverflows } from './overflow-check'
import { EXTRA_APP_ROUTES, LANDING_TARGETS, MARKETING_TARGETS, OVERLAY_TARGETS } from './sweep-targets'

const OUT = process.env.SWEEP_OUT ?? 'e2e/__sweep__'
const FROZEN_NOW = new Date('2026-08-15T12:00:00.000Z')
const LOADERS = '.animate-spin img[alt="Peanut mascot"], .animate-pulse'
const FREEZE_CSS = `
*, *::before, *::after {
    animation: none !important;
    transition: none !important;
    caret-color: transparent !important;
    scroll-behavior: auto !important;
}
/* the freeze cancels the fade-in-up-spring reveal, which would leave
   .animate-on-view wrappers at opacity 0 and hide their text from the
   scan — force them visible instead */
.animate-on-view {
    opacity: 1 !important;
    transform: none !important;
}
`
// same justification as the per-PR gate
const EXEMPT: string[] = ['.rfm-marquee-container']

const APP_LOCALES_SWEEP = ['en', 'es-419', 'es-AR', 'pt-BR'] as const

// locale fallback chains mirror src/i18n/app/messages.ts deepMerge order
const CATALOGS: Record<string, object[]> = {
    en: [en],
    'es-419': [es419, en],
    'es-AR': [esAR, es419, en],
    'pt-BR': [ptBR, en],
}

function resolveLabel(locale: string, keyPath: string): string | null {
    for (const catalog of CATALOGS[locale] ?? []) {
        let node: unknown = catalog
        for (const part of keyPath.split('.')) {
            if (typeof node !== 'object' || node === null) {
                node = undefined
                break
            }
            node = (node as Record<string, unknown>)[part]
        }
        if (typeof node === 'string') return node
    }
    return null
}

type Cell = {
    id: string
    kind: 'fixture' | 'overlay' | 'setup' | 'marketing' | 'landing'
    width: number
    locale: string
    status: 'pass' | 'fail' | 'skip'
    overflows?: unknown[]
    reason?: string
}

function record(cell: Cell, testInfo: TestInfo): void {
    mkdirSync(OUT, { recursive: true })
    appendFileSync(join(OUT, `${testInfo.project.name}-w${testInfo.workerIndex}.jsonl`), JSON.stringify(cell) + '\n')
}

function width(testInfo: TestInfo): number {
    return Number(testInfo.project.name.slice(1))
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
    await page.waitForFunction(
        () => {
            const seen = window as unknown as { __sweepText?: string }
            const text = document.body.innerText
            if (seen.__sweepText === text) return true
            seen.__sweepText = text
            return false
        },
        null,
        { polling: 250 }
    )
}

async function blockExternal(page: Page): Promise<void> {
    await page.route('**/*', (route) => {
        const { hostname } = new URL(route.request().url())
        return hostname === '127.0.0.1' || hostname === 'localhost' ? route.continue() : route.abort()
    })
}

function seenOnceModals(): void {
    window.sessionStorage.setItem('showNoMoreJailModal', 'true')
    window.localStorage.setItem('peanut_demo_activation_celebrated_at', '2026-01-01T00:00:00.000Z')
    window.localStorage.setItem(
        'demo-user:user-preferences',
        JSON.stringify({ hasSeenBalanceWarning: { value: true, expiry: 4102444800000 } })
    )
    window.sessionStorage.setItem('user_geo_country_code', 'DE')
    window.sessionStorage.setItem(
        'user_geo_country_code_timestamp',
        String(new Date('2026-08-15T11:59:00.000Z').getTime())
    )
}

async function scan(page: Page, cell: Omit<Cell, 'status'>, testInfo: TestInfo): Promise<void> {
    // scrolling can dismiss an open drawer — only walk the page when no
    // overlay is up (overlay content fits the viewport)
    const overlayOpen = await page.evaluate(
        () => document.querySelector('[data-vaul-drawer], [role="dialog"]') !== null
    )
    if (!overlayOpen) {
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
        await page.waitForTimeout(250)
        await page.evaluate(() => window.scrollTo(0, 0))
    }

    const overflows = await page.evaluate(findOverflows, EXEMPT)
    if (overflows.length > 0) {
        await page.evaluate((items) => {
            for (const item of items) {
                for (const el of Array.from(document.querySelectorAll('*'))) {
                    const text = (el as HTMLElement).innerText ?? (el as HTMLInputElement).placeholder ?? ''
                    if (text.trim().replace(/\s+/g, ' ').startsWith(item.text.slice(0, 40))) {
                        ;(el as HTMLElement).style.outline = '2px solid red'
                        break
                    }
                }
            }
        }, overflows)
        await testInfo.attach(`${cell.id}-${cell.locale}-overflow`, {
            body: await page.screenshot({ fullPage: true }),
            contentType: 'image/png',
        })
        record({ ...cell, status: 'fail', overflows }, testInfo)
    } else {
        record({ ...cell, status: 'pass' }, testInfo)
    }
    const report = overflows.map((o) => `[${o.kind}] ${o.selector} — “${o.text}” (${o.detail})`).join('\n')
    expect(overflows, `clipped ${cell.locale} copy on ${cell.id} @${cell.width}:\n${report}`).toEqual([])
}

test.describe.configure({ mode: 'parallel' })

// ---- app screens: fixtures + overlays + setup, per locale describe ----

for (const locale of APP_LOCALES_SWEEP) {
    test.describe(`app:${locale}`, () => {
        test.use({ locale })

        /** returns the landed pathname when the route bounced, else undefined */
        async function openApp(page: Page, route: string, fixture: string): Promise<string | undefined> {
            await blockExternal(page)
            await page.clock.setFixedTime(FROZEN_NOW)
            await page.addInitScript(seenOnceModals)
            await page.goto(fixtureHref(route, fixture), { waitUntil: 'domcontentloaded' })
            await expect
                .poll(() => page.evaluate((key) => window.sessionStorage.getItem(key), FIXTURE_STORAGE_KEY), {
                    message: 'fixture mode never engaged — preview build?',
                })
                .toBe(fixture)
            await settle(page)
            const landed = new URL(page.url()).pathname
            if (landed !== route.split('?')[0]) return landed
            return undefined
            // scan only after the app renders the catalog (IntlCore stamps lang)
            await expect
                .poll(() => page.evaluate(() => document.documentElement.lang), {
                    message: 'translated catalog never rendered',
                })
                .toBe(locale)
        }

        for (const [name, fixture] of Object.entries(FIXTURES)) {
            test(`fixture:${name}:${locale}`, async ({ page }, testInfo) => {
                const cell = { id: `fixture:${name}`, kind: 'fixture' as const, width: width(testInfo), locale }
                const bounced = await openApp(page, fixture.route, name)
                if (bounced) {
                    record({ ...cell, status: 'skip', reason: `redirected to ${bounced}` }, testInfo)
                    test.skip(true, `redirected to ${bounced}`)
                    return
                }
                await scan(page, cell, testInfo)
            })
        }

        for (const overlay of [...OVERLAY_TARGETS, ...EXTRA_APP_ROUTES]) {
            test(`overlay:${overlay.id}:${locale}`, async ({ page }, testInfo) => {
                const cell = { id: `overlay:${overlay.id}`, kind: 'overlay' as const, width: width(testInfo), locale }
                const bounced = await openApp(page, overlay.route, overlay.fixture ?? 'profile-edit')
                if (bounced) {
                    record({ ...cell, status: 'skip', reason: `redirected to ${bounced}` }, testInfo)
                    test.skip(true, `redirected to ${bounced}`)
                    return
                }
                if (overlay.proof) {
                    // a renamed query param degrades the cell to a base-page
                    // scan — prove the overlay actually opened
                    try {
                        await page.locator(overlay.proof).first().waitFor({ state: 'visible', timeout: 8_000 })
                    } catch {
                        record({ ...cell, status: 'skip', reason: `overlay never opened (${overlay.proof})` }, testInfo)
                        test.skip(true, 'overlay never opened')
                        return
                    }
                }
                for (const key of overlay.clickKeys ?? []) {
                    const label = resolveLabel(locale, key)
                    if (!label) {
                        record({ ...cell, status: 'skip', reason: `no catalog value for ${key}` }, testInfo)
                        test.skip(true, `no catalog value for ${key}`)
                        return
                    }
                    try {
                        await page.getByText(label, { exact: false }).first().click({ timeout: 8_000 })
                        await page.waitForTimeout(600)
                    } catch {
                        record({ ...cell, status: 'skip', reason: `could not click “${label}”` }, testInfo)
                        test.skip(true, `could not click ${key}`)
                        return
                    }
                }
                await scan(page, cell, testInfo)
            })
        }

        for (const route of ['/setup', '/setup?step=signup', '/setup?step=login']) {
            test(`setup:${route}:${locale}`, async ({ page }, testInfo) => {
                const cdp = await page.context().newCDPSession(page)
                await cdp.send('WebAuthn.enable')
                await cdp.send('WebAuthn.addVirtualAuthenticator', {
                    options: {
                        protocol: 'ctap2',
                        transport: 'internal',
                        hasResidentKey: true,
                        hasUserVerification: true,
                        isUserVerified: true,
                        automaticPresenceSimulation: true,
                    },
                })
                await blockExternal(page)
                await page.clock.setFixedTime(FROZEN_NOW)
                await page.goto(route, { waitUntil: 'domcontentloaded' })
                await settle(page)
                if (route.includes('step=signup')) {
                    await expect(page.locator('input:visible').first()).toBeVisible()
                }
                await expect
                    .poll(() => page.evaluate(() => document.documentElement.lang), {
                        message: 'translated catalog never rendered',
                    })
                    .toBe(locale)
                await scan(page, { id: `setup:${route}`, kind: 'setup', width: width(testInfo), locale }, testInfo)
            })
        }
    })
}

// ---- marketing: locale in the URL; full slug list at 320, reps everywhere ----

for (const target of MARKETING_TARGETS) {
    for (const locale of target.locales ?? ['en', 'es-419', 'es-ar', 'pt-br']) {
        const path = target.path.replace('{locale}', locale)
        test(`marketing:${path}`, async ({ page }, testInfo) => {
            test.skip(!target.allWidths && width(testInfo) !== 320, 'full slug list runs at 320 only')
            const cell = { id: `marketing:${path}`, kind: 'marketing' as const, width: width(testInfo), locale }
            await blockExternal(page)
            const response = await page.goto(path, { waitUntil: 'domcontentloaded' })
            await page.waitForTimeout(700)
            const landed = new URL(page.url()).pathname
            if (landed !== path.split('?')[0]) {
                record({ ...cell, status: 'skip', reason: `redirected to ${landed}` }, testInfo)
                test.skip(true, `redirected to ${landed}`)
                return
            }
            // a notFound() renders at the same pathname — a passing scan of a
            // 404 or an empty shell would be a vacuous pass
            const status = response?.status() ?? 0
            if (status >= 400) {
                record({ ...cell, status: 'skip', reason: `http ${status}` }, testInfo)
                test.skip(true, `http ${status}`)
                return
            }
            await settle(page)
            const textLength = await page.evaluate(() => document.body.innerText.trim().length)
            if (textLength < 40) {
                record({ ...cell, status: 'skip', reason: `thin page (${textLength} chars)` }, testInfo)
                test.skip(true, 'thin page')
                return
            }
            await scan(page, cell, testInfo)
        })
    }
}

for (const { locale, path } of LANDING_TARGETS) {
    test(`landing:${path}`, async ({ page }, testInfo) => {
        const cell = { id: `landing:${path}`, kind: 'landing' as const, width: width(testInfo), locale }
        await blockExternal(page)
        await page.clock.setFixedTime(FROZEN_NOW)
        await page.goto(path, { waitUntil: 'domcontentloaded' })
        await page.waitForTimeout(1500)
        // lazy sections mount on scroll — walk the page so the scan sees them
        await page.evaluate(async () => {
            for (let y = 0; y < document.body.scrollHeight; y += 400) {
                window.scrollTo(0, y)
                await new Promise((r) => setTimeout(r, 50))
            }
            window.scrollTo(0, 0)
        })
        await settle(page)
        await scan(page, cell, testInfo)
    })
}
