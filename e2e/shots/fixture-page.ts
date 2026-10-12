/**
 * Page setup shared by the overflow gates (overflow.spec.ts,
 * overflow-truncation.spec.ts): a fixture opened, frozen and settled the same
 * way, so the two checks read the same screen.
 */

import { expect, type Page } from '@playwright/test'
import { FIXTURE_STORAGE_KEY, fixtureHref } from '../../src/dev/fixtures/active'
import { FIXTURES } from '../../src/dev/fixtures/registry'

export const FROZEN_NOW = new Date('2026-08-15T12:00:00.000Z')
export const LOADERS = '.animate-spin img[alt="Peanut mascot"], .animate-pulse'
export const FREEZE_CSS = `
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

export async function settle(page: Page): Promise<void> {
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
    // wait for script-driven text (count-ups) to stop changing
    await page.waitForFunction(
        () => {
            const seen = window as unknown as { __overflowText?: string }
            const text = document.body.innerText
            if (seen.__overflowText === text) return true
            seen.__overflowText = text
            return false
        },
        null,
        { polling: 250 }
    )
}

export async function blockExternal(page: Page): Promise<void> {
    await page.route('**/*', (route) => {
        const { hostname } = new URL(route.request().url())
        return hostname === '127.0.0.1' || hostname === 'localhost' ? route.continue() : route.abort()
    })
}

export function seenOnceModals(): void {
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

/**
 * Open a registry fixture the way every gate reads it: external calls blocked,
 * time frozen, once-only modals seen, the fixture engaged, the page settled
 * and the project's locale actually rendered.
 */
export async function openFixture(page: Page, name: string, locale: string | undefined): Promise<void> {
    const fixture = FIXTURES[name]
    await blockExternal(page)
    await page.clock.setFixedTime(FROZEN_NOW)
    await page.addInitScript(seenOnceModals)

    await page.goto(fixtureHref(fixture.route, name), { waitUntil: 'domcontentloaded' })
    await expect
        .poll(() => page.evaluate((key) => window.sessionStorage.getItem(key), FIXTURE_STORAGE_KEY), {
            message: 'fixture mode never engaged — is this a NEXT_PUBLIC_VERCEL_ENV=preview build?',
        })
        .toBe(name)
    // A fixture whose whole subject is a loader never settles: its
    // skeleton pulses until a provider answers, which cannot happen here.
    if (fixture.isLoadingState) {
        if (fixture.waitFor) await page.locator(fixture.waitFor).first().waitFor({ state: 'visible' })
    } else await settle(page)

    // prove the app actually RENDERED this locale, or the gate scans the
    // English it hydrates with: IntlCore stamps <html lang> only after the
    // async catalog is applied, so wait for that — navigator.language only
    // proves the browser asked for it
    await expect
        .poll(() => page.evaluate(() => document.documentElement.lang), {
            message: 'translated catalog never rendered',
        })
        .toBe(locale)
}
