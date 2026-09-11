/**
 * i18n overflow gate (TASK-22366): render screens in every supported
 * non-English locale at 320px and FAIL when translated copy is actually
 * clipped. One Playwright project per locale (playwright.overflow.config.ts);
 * es-419 is not a safe maximum — hundreds of pt-BR strings run longer.
 *
 * This is an absolute DOM check, not a visual diff: no baselines, no pixel
 * comparison. The detector lives in overflow-check.ts (shared with the
 * synthetic self-tests in overflow-detector.spec.ts). Elements that opt into
 * truncation (text-overflow: ellipsis, line-clamp — addresses, usernames)
 * are skipped by design.
 *
 * Coverage: every fixture in src/dev/fixtures/registry.ts, the localized
 * landing/marketing routes for the project's locale, and the signup/setup
 * screens (reached with a CDP virtual authenticator so the passkey preflight
 * passes in headless).
 *
 *   npm run test:i18n-overflow:run
 */

import { expect, test, type Page, type TestInfo } from '@playwright/test'
import { FIXTURE_STORAGE_KEY, fixtureHref } from '../../src/dev/fixtures/active'
import { FIXTURES } from '../../src/dev/fixtures/registry'
import { findOverflows } from './overflow-check'

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

// Known intentional clips — CSS selectors matched against the offending
// element (or any ancestor). Keep every entry justified; an unexplained entry
// is a hidden bug.
const EXEMPT: string[] = [
    // react-fast-marquee tickers: the text scrolls through the clip by design
    '.rfm-marquee-container',
]

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

async function assertNoOverflow(page: Page, id: string, testInfo: TestInfo) {
    // the check walks the whole document, so pull below-fold content in too
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await page.waitForTimeout(300)
    await page.evaluate(() => window.scrollTo(0, 0))

    const overflows = await page.evaluate(findOverflows, EXEMPT)

    if (overflows.length > 0) {
        // outline the offenders so the failure screenshot points at them
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
        await testInfo.attach(`${id}-overflow`, {
            body: await page.screenshot({ fullPage: true }),
            contentType: 'image/png',
        })
    }

    const report = overflows.map((o) => `[${o.kind}] ${o.selector} — “${o.text}” (${o.detail})`).join('\n')
    expect(overflows, `clipped ${testInfo.project.name} copy on ${id}:\n${report}`).toEqual([])
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

test.describe.configure({ mode: 'parallel' })

// ---- app screens: one test per fixture, locale via navigator.language ----

for (const [name, fixture] of Object.entries(FIXTURES)) {
    test(`fixture:${name}`, async ({ page }, testInfo) => {
        await blockExternal(page)
        await page.clock.setFixedTime(FROZEN_NOW)
        await page.addInitScript(seenOnceModals)

        await page.goto(fixtureHref(fixture.route, name), { waitUntil: 'domcontentloaded' })
        await expect
            .poll(() => page.evaluate((key) => window.sessionStorage.getItem(key), FIXTURE_STORAGE_KEY), {
                message: 'fixture mode never engaged — is this a NEXT_PUBLIC_VERCEL_ENV=preview build?',
            })
            .toBe(name)
        await settle(page)

        // prove the app actually RENDERED this locale, or the gate scans the
        // English it hydrates with: IntlCore stamps <html lang> only after the
        // async catalog is applied, so wait for that — navigator.language only
        // proves the browser asked for it
        await expect
            .poll(() => page.evaluate(() => document.documentElement.lang), {
                message: 'translated catalog never rendered',
            })
            .toBe(testInfo.project.use.locale)

        await assertNoOverflow(page, `fixture:${name}`, testInfo)
    })
}

// ---- landing / marketing: locale comes from the route, so each project
// checks its own locale's routes (the table-heavy marketing templates render
// through the same mdx components — one representative slug each) ----

const LANDING_ROUTES: Record<string, string[]> = {
    'es-419': ['/es-419', '/es-419/pricing', '/es-419/compare/wise'],
    'pt-BR': ['/pt-br', '/pt-br/argentina'],
    'es-AR': ['/es-ar'],
}

for (const [locale, routes] of Object.entries(LANDING_ROUTES)) {
    for (const route of routes) {
        test(`landing:${route}`, async ({ page }, testInfo) => {
            test.skip(testInfo.project.use.locale !== locale, `belongs to the ${locale} project`)
            await blockExternal(page)
            await page.clock.setFixedTime(FROZEN_NOW)
            await page.goto(route, { waitUntil: 'domcontentloaded' })
            await settle(page)
            await assertNoOverflow(page, `landing:${route}`, testInfo)
        })
    }
}

// ---- signup/setup: needs a virtual authenticator or the passkey preflight
// bounces headless Chromium to the unsupported-browser screen ----

const SETUP_ROUTES = ['/setup', '/setup?step=signup', '/setup?step=login']

for (const route of SETUP_ROUTES) {
    test(`setup:${route}`, async ({ page }, testInfo) => {
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

        // /setup on the mobile-web UA renders the install wall — a real
        // localized screen, gate it as-is. ?step=signup must reach the real
        // signup form (the original "Usuario*" overflow lived in its input):
        // the virtual authenticator makes the passkey preflight pass, and the
        // visible input proves we are not on the install/unsupported wall.
        if (route.includes('step=signup')) {
            await expect(page.locator('input:visible').first()).toBeVisible()
        }

        // same catalog race as the fixture tests: scan only after the app
        // stamps the rendered locale
        await expect
            .poll(() => page.evaluate(() => document.documentElement.lang), {
                message: 'translated catalog never rendered',
            })
            .toBe(testInfo.project.use.locale)

        await assertNoOverflow(page, `setup:${route}`, testInfo)
    })
}
