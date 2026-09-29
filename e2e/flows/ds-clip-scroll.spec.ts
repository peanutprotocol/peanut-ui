/**
 * DS showcase shell — focus rings are not clipped, and a scroll column does not
 * leak its scroll to the page.
 *
 * The shell (src/app/(mobile-ui)/dev/ds/layout.tsx) scrolls two columns on
 * their own. Two defects follow from that, and both come back the moment
 * someone moves padding or adds a scroll box:
 *   1. an overflow box clips painting at its padding edge, so a focus ring
 *      (outline or ring shadow) on a child that touches that edge is cut off.
 *      ds-shadow-clip.spec.ts checks the button shadow; this checks the ring.
 *   2. the page behind the columns must never scroll. An absolutely
 *      positioned child of a non-positioned column escapes it and gives
 *      #scrollable-content real overflow; a wheel past the column's end then
 *      scrolls the header and sidebar away. Every route is swept for that
 *      overflow, and the long page is wheeled past its end.
 *
 * Runs at 768 and 1280, where the sidebar is on screen.
 *
 *   NEXT_PUBLIC_VERCEL_ENV=preview npm run build
 *   npm run test:e2e:regression -- ds-clip-scroll
 */

import { expect, test, type Page } from '@playwright/test'
import { FIXTURE_STORAGE_KEY } from '../../src/dev/fixtures/active'
import { SIDEBAR_CONFIG, TIERS } from '../../src/app/(mobile-ui)/dev/ds/_components/nav-config'

// same fixture as ds-shadow-clip.spec.ts: without it /dev bounces to /setup
const FIXTURE = 'profile-edit'
const SIDEBAR = 'nav[aria-label="Design system"]'
// a long page: the content column has a real scroll end to overscroll past
const LONG_ROUTE = '/dev/ds/primitives/pin-input'
// pages with focusables against the content column's left and right edges
const CONTENT_ROUTES = ['/dev/ds', '/dev/ds/primitives/button', LONG_ROUTE]

const ROUTES = Array.from(
    new Set([
        '/dev/ds',
        ...[...TIERS, ...Object.values(SIDEBAR_CONFIG).flat()]
            .map((item) => item.href)
            .filter((href) => href.startsWith('/dev/ds')),
    ])
)

const VIEWPORTS = [
    { name: '768x1024', width: 768, height: 1024 },
    { name: '1280x800', width: 1280, height: 800 },
]

async function open(page: Page, route: string) {
    const res = await page.goto(`${route}?__fixture=${FIXTURE}`, { waitUntil: 'domcontentloaded' })
    expect(res?.ok(), `${route} responded non-2xx`).toBeTruthy()
    await expect
        .poll(() => page.evaluate((key) => window.sessionStorage.getItem(key), FIXTURE_STORAGE_KEY), {
            message: 'fixture mode never engaged — is this a NEXT_PUBLIC_VERCEL_ENV=preview build?',
        })
        .toBe(FIXTURE)
    await expect(page.locator(SIDEBAR).first()).toBeVisible()
    // a key press first: .focus() after keyboard input matches :focus-visible
    await page.keyboard.press('Shift')
}

/**
 * Runs in the page. Focuses every element matching `selector` inside `root`
 * and reports each one whose focus ring (outline + outline-offset, and any
 * outer box-shadow) sticks out of the visible padding box of its nearest
 * clipping ancestor. The scroll box is moved so the element is fully in view
 * first — a ring is judged where the user would actually see it.
 */
function collectRingClips({ root, selector }: { root: string; selector: string }): string[] {
    const TOLERANCE = 1
    const describe = (el: Element) =>
        `${el.tagName.toLowerCase()} "${(el.textContent || el.getAttribute('aria-label') || el.getAttribute('placeholder') || '').trim().slice(0, 30)}"`

    const ringExtent = (cs: CSSStyleDeclaration) => {
        let reach = 0
        if (cs.outlineStyle !== 'none') {
            reach = Math.max(reach, parseFloat(cs.outlineWidth) + parseFloat(cs.outlineOffset))
        }
        for (const layer of cs.boxShadow === 'none' ? [] : cs.boxShadow.split(/,(?![^(]*\))/)) {
            if (layer.includes('inset')) continue
            const [x = 0, y = 0, blur = 0, spread = 0] = (
                layer.replace(/\w+\([^)]*\)/g, '').match(/-?[\d.]+px/g) ?? []
            ).map(parseFloat)
            reach = Math.max(reach, Math.abs(x) + blur + spread, Math.abs(y) + blur + spread)
        }
        return reach
    }

    const scope = document.querySelector(root)
    if (!scope) return [`${root} not found`]
    const offenders: string[] = []

    for (const el of Array.from(scope.querySelectorAll<HTMLElement>(selector))) {
        if (el.getClientRects().length === 0) continue
        let clip: HTMLElement | null = el.parentElement
        while (clip && clip !== document.body) {
            const cs = getComputedStyle(clip)
            if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible') break
            clip = clip.parentElement
        }
        if (!clip || clip === document.body) continue

        el.focus({ preventScroll: true })
        if (document.activeElement !== el) continue
        const reach = ringExtent(getComputedStyle(el))
        if (reach === 0) continue

        // bring the element into full view, ring included
        const clipBox = clip.getBoundingClientRect()
        const r0 = el.getBoundingClientRect()
        clip.scrollTop += r0.top - clipBox.top - clip.clientHeight / 2 + r0.height / 2

        const cs = getComputedStyle(clip)
        const box = clip.getBoundingClientRect()
        const left = box.left + parseFloat(cs.borderLeftWidth)
        const top = box.top + parseFloat(cs.borderTopWidth)
        const right = left + clip.clientWidth
        const bottom = top + clip.clientHeight
        const r = el.getBoundingClientRect()

        // the element itself out of view (e.g. a horizontal code scroller) is not this bug
        if (r.left < left - TOLERANCE || r.right > right + TOLERANCE) continue
        if (r.top < top - TOLERANCE || r.bottom > bottom + TOLERANCE) continue

        const over = {
            left: left - (r.left - reach),
            right: r.right + reach - right,
            top: top - (r.top - reach),
            bottom: r.bottom + reach - bottom,
        }
        const sides = Object.entries(over)
            .filter(([, v]) => v > TOLERANCE)
            .map(([k, v]) => `${k}:${v.toFixed(1)}`)
        if (sides.length) offenders.push(`${describe(el)} ring ${reach}px cut ${sides.join(' ')}`)
    }
    ;(document.activeElement as HTMLElement | null)?.blur()
    return offenders
}

for (const viewport of VIEWPORTS) {
    test.describe(`DS shell at ${viewport.name}`, () => {
        test.beforeEach(async ({ page }) => {
            await page.setViewportSize({ width: viewport.width, height: viewport.height })
            await page.route('**/*', (route) => {
                const { hostname } = new URL(route.request().url())
                return hostname === '127.0.0.1' || hostname === 'localhost' ? route.continue() : route.abort()
            })
        })

        test('focus rings are not clipped', async ({ page }) => {
            const offenders: string[] = []
            await open(page, '/dev/ds')
            offenders.push(
                ...(await page.evaluate(collectRingClips, { root: SIDEBAR, selector: 'input, a' })).map(
                    (o) => `sidebar: ${o}`
                )
            )
            for (const route of CONTENT_ROUTES) {
                await open(page, route)
                const found = await page.evaluate(collectRingClips, {
                    root: '#scrollable-content',
                    selector: `:not(${SIDEBAR} *):is(a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"]))`,
                })
                offenders.push(...found.map((o) => `${route}: ${o}`))
            }
            expect(offenders, `focus rings clipped:\n  ${offenders.join('\n  ')}`).toEqual([])
        })

        test('the shell behind the columns has nothing to scroll', async ({ page }) => {
            test.setTimeout(ROUTES.length * 5_000)
            const offenders: string[] = []
            for (const route of ROUTES) {
                await open(page, route)
                await page.waitForTimeout(300)
                const extra = await page.evaluate(() => {
                    const shell = document.getElementById('scrollable-content')
                    const doc = document.documentElement
                    return {
                        shell: shell ? shell.scrollHeight - shell.clientHeight : 0,
                        window: doc.scrollHeight - doc.clientHeight,
                    }
                })
                if (extra.shell > 1 || extra.window > 1)
                    offenders.push(`${route}: shell +${extra.shell}px, window +${extra.window}px`)
            }
            expect(offenders, `page behind the DS columns can scroll:\n  ${offenders.join('\n  ')}`).toEqual([])
        })

        test('a scroll column does not leak its scroll to the page', async ({ page }) => {
            await open(page, LONG_ROUTE)
            const sidebar = page.locator(SIDEBAR).first()
            const box = await sidebar.boundingBox()
            const read = () =>
                page.evaluate((sel) => {
                    const col = document.querySelector(sel)?.parentElement
                    return {
                        windowY: window.scrollY,
                        shellY: document.getElementById('scrollable-content')?.scrollTop ?? 0,
                        sidebarY: col?.scrollTop ?? -1,
                        contentY: col?.nextElementSibling?.scrollTop ?? -1,
                    }
                }, SIDEBAR)

            // wheel far past the content column's end, pointer right of the sidebar
            await page.mouse.move((box?.x ?? 0) + (box?.width ?? 0) + 200, viewport.height / 2)
            for (let i = 0; i < 10; i++) await page.mouse.wheel(0, 2000)
            await page.waitForTimeout(300)
            const afterContent = await read()
            expect(afterContent.contentY, 'content column never scrolled — nothing tested').toBeGreaterThan(0)
            expect({ ...afterContent, contentY: 0 }).toEqual({ windowY: 0, shellY: 0, sidebarY: 0, contentY: 0 })

            // and past the sidebar's end, pointer over the sidebar
            await page.mouse.move((box?.x ?? 0) + 40, viewport.height / 2)
            for (let i = 0; i < 10; i++) await page.mouse.wheel(0, 2000)
            await page.waitForTimeout(300)
            const afterSidebar = await read()
            expect({ windowY: afterSidebar.windowY, shellY: afterSidebar.shellY }).toEqual({ windowY: 0, shellY: 0 })
        })
    })
}
