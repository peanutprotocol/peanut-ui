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
import { FIXTURES } from '../../src/dev/fixtures/registry'
import { blockExternal, FROZEN_NOW, openFixture, settle } from './fixture-page'
import { findOverflows } from './overflow-check'

// Known intentional clips — CSS selectors matched against the offending
// element (or any ancestor). Keep every entry justified; an unexplained entry
// is a hidden bug.
const EXEMPT: string[] = [
    // react-fast-marquee tickers: the text scrolls through the clip by design
    '.rfm-marquee-container',
    // PixelatedCardFace: decorative card art — the pixel-font "????" line box
    // deliberately overhangs the rounded card frame's clip; no locale copy
    // renders inside it
    '[data-decorative-clip]',
]

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

test.describe.configure({ mode: 'parallel' })

// ---- app screens: one test per fixture, locale via navigator.language ----

for (const name of Object.keys(FIXTURES)) {
    test(`fixture:${name}`, async ({ page }, testInfo) => {
        await openFixture(page, name, testInfo.project.use.locale)

        await assertNoOverflow(page, `fixture:${name}`, testInfo)
    })
}

// ---- landing / marketing: the locale comes from the ROUTE, not the browser,
// so the key below only says which project runs the route. The English pages
// ride in the es-419 project rather than paying for a whole extra English run
// of every fixture and setup test. /careers lives outside [locale] and is
// English-only. (the table-heavy marketing templates render through the same
// mdx components — one representative slug each) ----

const LANDING_ROUTES: Record<string, string[]> = {
    'es-419': [
        '/es-419',
        '/es-419/pricing',
        '/es-419/compare/wise',
        '/en/press',
        '/en/content',
        '/en/help',
        '/en/status',
        '/en/stories',
        '/careers',
    ],
    'pt-BR': [
        '/pt-br',
        '/pt-br/argentina',
        '/pt-br/press',
        '/pt-br/content',
        '/pt-br/help',
        '/pt-br/status',
        '/pt-br/stories',
    ],
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
