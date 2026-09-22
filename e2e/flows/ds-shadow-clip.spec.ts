/**
 * DS showcase — no button shadow may be clipped.
 *
 * Every DS button paints a hard 4px offset shadow (`.btn-primary` /
 * `.btn-stroke`, `shadow-[0.25rem_0.25rem_0_...]`). A box-shadow is NOT part of
 * an element's scrollable overflow region, so any ancestor whose overflow is
 * not `visible` paints the button and then cuts its shadow off in a straight
 * line at the padding-box edge. The same defect was fixed in the product drawer
 * (src/components/Global/Drawer/index.tsx) by moving the padding INSIDE the
 * clip box; this gate keeps the showcase from growing a new one.
 *
 * The check walks every doc page from the showcase's own nav config, so a new
 * page joins the net automatically. It runs at 375x667 (the reported width) and
 * at 1280x800, where the desktop two-column grid puts buttons against different
 * edges.
 *
 *   NEXT_PUBLIC_VERCEL_ENV=preview npm run build
 *   npm run test:e2e:regression -- ds-shadow-clip
 */

import { expect, test, type Page } from '@playwright/test'
import { FIXTURE_STORAGE_KEY } from '../../src/dev/fixtures/active'
import { SIDEBAR_CONFIG, TIERS } from '../../src/app/(mobile-ui)/dev/ds/_components/nav-config'

// Without a fake session /dev bounces to /setup, and without faked API answers
// the shell renders its "trouble connecting" screen — both of which have no
// showcase buttons in them, so the sweep would pass on an empty page. Same
// fixture the shot capture uses (e2e/shots/pages.spec.ts).
const FIXTURE = 'profile-edit'

const DS_ROUTES = [...TIERS, ...Object.values(SIDEBAR_CONFIG).flat()]
    .map((item) => item.href)
    .filter((href) => href.startsWith('/dev/ds'))

const ROUTES = Array.from(new Set(['/dev/ds', ...DS_ROUTES]))

const VIEWPORTS = [
    { name: '375x667', width: 375, height: 667 },
    { name: '1280x800', width: 1280, height: 800 },
]

interface Offender {
    route?: string
    button: string
    overflowBy: string
    clippedBy: string
}

/**
 * Runs in the page. For every button carrying an outer box-shadow, expands the
 * border box by the shadow's offset/blur/spread and asks whether the nearest
 * clipping ancestor still contains it.
 *
 * Only flags a button whose BORDER box fits but whose SHADOW box does not —
 * a button that is itself outside the clip box is a layout bug, not this one.
 */
function collectShadowClips(): Offender[] {
    const TOLERANCE = 1 // px: scrollWidth/clientWidth are integers, rects are not

    const describe = (el: Element) => {
        const tag = el.tagName.toLowerCase()
        const cls = (el.getAttribute('class') ?? '').split(/\s+/).filter(Boolean).slice(0, 4).join('.')
        const text = (el.textContent ?? '').trim().slice(0, 30)
        return `${tag}${cls ? `.${cls}` : ''}${text ? ` "${text}"` : ''}`
    }

    // computed box-shadow: "rgb(0, 0, 0) 4px 4px 0px 0px, rgba(...) 0px 0px 0px 1px inset"
    const shadowExtent = (value: string) => {
        if (!value || value === 'none') return null
        const layers = value.split(/,(?![^(]*\))/)
        let l = 0
        let r = 0
        let t = 0
        let b = 0
        let found = false
        for (const layer of layers) {
            if (layer.includes('inset')) continue
            const nums = (layer.replace(/\w+\([^)]*\)/g, '').match(/-?[\d.]+px/g) ?? []).map(parseFloat)
            if (nums.length < 2) continue
            const [offX, offY, blur = 0, spread = 0] = nums
            const reach = blur + spread
            if (offX === 0 && offY === 0 && reach === 0) continue
            found = true
            l = Math.min(l, offX - reach)
            r = Math.max(r, offX + reach)
            t = Math.min(t, offY - reach)
            b = Math.max(b, offY + reach)
        }
        return found ? { l, r, t, b } : null
    }

    const offenders: Offender[] = []

    const buttons = document.querySelectorAll('button, a.btn, .btn, [class*="btn-"]')
    for (const el of Array.from(buttons)) {
        const style = getComputedStyle(el)
        if (style.visibility === 'hidden' || style.display === 'none') continue
        const extent = shadowExtent(style.boxShadow)
        if (!extent) continue

        const rect = el.getBoundingClientRect()
        if (rect.width === 0 || rect.height === 0) continue
        const shadow = {
            left: rect.left + extent.l,
            right: rect.right + extent.r,
            top: rect.top + extent.t,
            bottom: rect.bottom + extent.b,
        }

        for (let node = el.parentElement; node && node !== document.body; node = node.parentElement) {
            const cs = getComputedStyle(node)
            const clipsX = cs.overflowX !== 'visible'
            const clipsY = cs.overflowY !== 'visible'
            const clipPath = cs.clipPath !== 'none'
            if (!clipsX && !clipsY && !clipPath) continue

            const nodeRect = node.getBoundingClientRect()
            const padLeft = nodeRect.left + parseFloat(cs.borderLeftWidth)
            const padTop = nodeRect.top + parseFloat(cs.borderTopWidth)

            // Painting is cut at the padding box, and a box-shadow is never
            // part of an element's scrollable overflow, so the two axes are
            // judged differently:
            //   X — the visible window. A doc column scrolls DOWN, never
            //       sideways, so a shadow that only appears after a sideways
            //       drag is cut off in practice. Any sideways range it has is
            //       an accident of some other element sticking out.
            //   Y — the scrollable region. Scrolling down is how the page is
            //       read, so a shadow further down is genuinely visible; only
            //       one past the END of the region can never be reached.
            const bounds = {
                left: padLeft,
                right: padLeft + node.clientWidth,
                top: padTop - node.scrollTop,
                bottom: padTop - node.scrollTop + node.scrollHeight,
            }
            if (clipPath) {
                // cannot evaluate an arbitrary shape — assume the border box
                bounds.left = nodeRect.left
                bounds.top = nodeRect.top
                bounds.right = nodeRect.right
                bounds.bottom = nodeRect.bottom
            }

            // how far [lo, hi] sticks out of [boxLo, boxHi], 0 when it fits
            const over = (axisClips: boolean, lo: number, hi: number, boxLo: number, boxHi: number) =>
                axisClips ? Math.max(0, boxLo - lo, hi - boxHi) : 0

            const elOver =
                over(clipsX || clipPath, rect.left, rect.right, bounds.left, bounds.right) +
                over(clipsY || clipPath, rect.top, rect.bottom, bounds.top, bounds.bottom)
            if (elOver > TOLERANCE) break // the button itself is out of view — not our bug

            const dx = over(clipsX || clipPath, shadow.left, shadow.right, bounds.left, bounds.right)
            const dy = over(clipsY || clipPath, shadow.top, shadow.bottom, bounds.top, bounds.bottom)
            if (dx > TOLERANCE || dy > TOLERANCE) {
                offenders.push({
                    button: describe(el),
                    overflowBy: `x:${dx.toFixed(1)} y:${dy.toFixed(1)}`,
                    clippedBy: `${describe(node)} [overflow ${cs.overflowX}/${cs.overflowY}]`,
                })
            }
            break // only the nearest clipping ancestor matters
        }
    }

    return offenders
}

async function scan(page: Page, route: string): Promise<Offender[]> {
    const res = await page.goto(`${route}?__fixture=${FIXTURE}`, { waitUntil: 'domcontentloaded' })
    expect(res?.ok(), `${route} responded non-2xx`).toBeTruthy()
    await expect
        .poll(() => page.evaluate((key) => window.sessionStorage.getItem(key), FIXTURE_STORAGE_KEY), {
            message: 'fixture mode never engaged — is this a NEXT_PUBLIC_VERCEL_ENV=preview build?',
        })
        .toBe(FIXTURE)
    // the showcase mounts client components on hydration; the doc pages have no
    // data fetch, so a settle beat is enough and keeps the sweep deterministic
    await page.waitForTimeout(600)
    const found = await page.evaluate(collectShadowClips)
    return found.map((o) => ({ route, ...o }))
}

for (const viewport of VIEWPORTS) {
    test(`DS showcase buttons keep their shadow at ${viewport.name}`, async ({ page }) => {
        test.setTimeout(ROUTES.length * 8_000)
        await page.setViewportSize({ width: viewport.width, height: viewport.height })
        // third-party scripts (analytics, RPCs) only add flake here
        await page.route('**/*', (route) => {
            const { hostname } = new URL(route.request().url())
            return hostname === '127.0.0.1' || hostname === 'localhost' ? route.continue() : route.abort()
        })

        const offenders: Offender[] = []
        for (const route of ROUTES) {
            offenders.push(...(await scan(page, route)))
        }

        const report = offenders
            .map((o) => `  ${o.route}\n    ${o.button}\n    clipped by ${o.clippedBy} (over ${o.overflowBy})`)
            .join('\n')
        expect(offenders, `button shadows clipped at ${viewport.name}:\n${report}`).toEqual([])
    })
}
