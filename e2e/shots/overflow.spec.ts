/**
 * i18n overflow gate (TASK-22366): render screens in es-419 — the longest
 * locale — at 320px and FAIL when translated copy is actually clipped.
 *
 * This is an absolute DOM check, not a visual diff: no baselines, no pixel
 * comparison. A test fails when an element that directly holds text is
 * clipped by its own overflow, or when an input's placeholder is wider than
 * the input. Elements that opt into truncation (text-overflow: ellipsis,
 * line-clamp — addresses, usernames) are skipped by design.
 *
 * Coverage: every fixture in src/dev/fixtures/registry.ts, the localized
 * landing/marketing routes, and the signup/setup screens (reached with a CDP
 * virtual authenticator so the passkey preflight passes in headless).
 *
 *   pnpm exec playwright test --config=playwright.shots.config.ts --project=overflow
 */

import { expect, test, type Page, type TestInfo } from '@playwright/test'
import { FIXTURE_STORAGE_KEY, fixtureHref } from '../../src/dev/fixtures/active'
import { FIXTURES } from '../../src/dev/fixtures/registry'

const FROZEN_NOW = new Date('2026-08-15T12:00:00.000Z')
const LOADERS = '.animate-spin img[alt="Peanut mascot"], .animate-pulse'
const FREEZE_CSS = `
*, *::before, *::after {
    animation: none !important;
    transition: none !important;
    caret-color: transparent !important;
    scroll-behavior: auto !important;
}
`

// Known intentional clips — CSS selectors matched against the offending
// element (or any ancestor). Keep every entry justified; an unexplained entry
// is a hidden bug.
const EXEMPT: string[] = [
    // react-fast-marquee tickers: the text scrolls through the clip by design
    '.rfm-marquee-container',
]

type Overflow = {
    selector: string
    text: string
    kind: 'clip-x' | 'clip-y' | 'placeholder'
    detail: string
}

/**
 * Runs in the page. Finds text the user cannot read:
 *  - an element with a direct text node, clipped by its own overflow
 *    hidden/clip (scrollable containers are fine, ellipsis/line-clamp are
 *    deliberate truncation and skipped)
 *  - a container with overflow hidden whose text content is wider than the
 *    box (the text usually lives in a child whose own box grew to fit)
 *  - an input/textarea whose placeholder or value is wider than its content
 *    box (inputs clip natively, scrollWidth does not see it — the original
 *    "Usuario*" bug)
 */
function findOverflows(exempt: string[]): Overflow[] {
    const bad: Overflow[] = []
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')!

    const path = (el: Element): string => {
        const parts: string[] = []
        let node: Element | null = el
        while (node && node !== document.body && parts.length < 4) {
            const cls = [...node.classList].slice(0, 3).join('.')
            parts.unshift(node.tagName.toLowerCase() + (cls ? `.${cls}` : ''))
            node = node.parentElement
        }
        return parts.join(' > ')
    }

    const isExempt = (el: Element): boolean =>
        exempt.some((sel) => {
            try {
                return el.closest(sel) !== null
            } catch {
                return false
            }
        })

    const seen = new Set<string>()
    const flag = (el: Element, kind: Overflow['kind'], detail: string, text?: string) => {
        const sample = (text ?? (el as HTMLElement).innerText ?? '').trim().replace(/\s+/g, ' ').slice(0, 80)
        const key = `${kind}|${sample}`
        if (seen.has(key)) return
        seen.add(key)
        bad.push({ selector: path(el), text: sample, kind, detail })
    }

    const visible = (el: Element): boolean => {
        const cs = getComputedStyle(el)
        if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) return false
        const rect = el.getBoundingClientRect()
        // sr-only / visually-hidden text lives in a 1px clipped box on purpose
        return rect.width > 2 && rect.height > 2
    }

    const truncates = (el: Element): boolean => {
        const cs = getComputedStyle(el)
        const clamp = (cs as unknown as Record<string, string>).webkitLineClamp
        return cs.textOverflow === 'ellipsis' || (clamp !== undefined && clamp !== 'none')
    }

    const hasOwnText = (el: Element): boolean =>
        Array.from(el.childNodes).some((n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? '').trim().length > 0)

    for (const el of Array.from(document.body.querySelectorAll('*'))) {
        if (!visible(el)) continue
        if (isExempt(el)) continue
        const cs = getComputedStyle(el)

        if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
            if (el.type === 'checkbox' || el.type === 'radio' || el.type === 'hidden') continue
            const text = (el.value || el.placeholder || '').trim()
            if (!text) continue
            ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`
            const needed = ctx.measureText(text).width
            const inner = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)
            if (needed > inner + 1) {
                flag(el, 'placeholder', `text needs ${Math.round(needed)}px, input fits ${Math.round(inner)}px`, text)
            }
            continue
        }

        const hiddenX = cs.overflowX === 'hidden' || cs.overflowX === 'clip'
        const hiddenY = cs.overflowY === 'hidden' || cs.overflowY === 'clip'
        const clipX = hiddenX && el.scrollWidth > el.clientWidth + 1
        // +3 vertical tolerance: line-height rounding trips a +1 check
        const clipY = hiddenY && el.scrollHeight > el.clientHeight + 3
        if (!clipX && !clipY) continue

        // The clipped pixels may be decorative (positioned art bleeding off a
        // hero on purpose), so attribute the clip to TEXT: flag only text-
        // bearing descendants whose box actually crosses the clipped edge.
        const box = el.getBoundingClientRect()

        // the element clips its own direct text — scrollWidth already proves it
        if (hasOwnText(el) && !truncates(el)) {
            if (clipX) flag(el, 'clip-x', `scrollWidth ${el.scrollWidth} > clientWidth ${el.clientWidth}`)
            else flag(el, 'clip-y', `scrollHeight ${el.scrollHeight} > clientHeight ${el.clientHeight}`)
            continue
        }

        const holders = Array.from(el.querySelectorAll('*')).filter(
            (d) => hasOwnText(d) && visible(d) && !truncates(d) && !isExempt(d)
        )
        for (const d of holders) {
            const r = d.getBoundingClientRect()
            if (clipX && r.right > box.right + 2) {
                flag(d, 'clip-x', `text box right ${Math.round(r.right)}px > clip edge ${Math.round(box.right)}px`)
            } else if (clipY && r.bottom > box.bottom + 3) {
                flag(d, 'clip-y', `text box bottom ${Math.round(r.bottom)}px > clip edge ${Math.round(box.bottom)}px`)
            }
        }
    }
    return bad
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
    expect(overflows, `clipped es-419 copy on ${id}:\n${report}`).toEqual([])
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

// ---- app screens: one test per fixture, es-419 via navigator.language ----

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

        // prove the app actually rendered Spanish, or the whole gate is a no-op
        await expect
            .poll(() => page.evaluate(() => navigator.language), { message: 'context locale not applied' })
            .toBe('es-419')

        await assertNoOverflow(page, `fixture:${name}`, testInfo)
    })
}

// ---- landing / marketing: locale comes from the route ----

// The two localized landing pages plus the table-heavy marketing templates
// (pricing, compare, country) — one representative slug each; every slug of a
// template renders through the same mdx components.
const LANDING_ROUTES = ['/es-419', '/pt-br', '/es-419/pricing', '/es-419/compare/wise', '/pt-br/argentina']

for (const route of LANDING_ROUTES) {
    test(`landing:${route}`, async ({ page }, testInfo) => {
        await blockExternal(page)
        await page.clock.setFixedTime(FROZEN_NOW)
        await page.goto(route, { waitUntil: 'domcontentloaded' })
        await settle(page)
        await assertNoOverflow(page, `landing:${route}`, testInfo)
    })
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

        await assertNoOverflow(page, `setup:${route}`, testInfo)
    })
}
