/**
 * DS showcase — no button shadow may be clipped.
 *
 * Every DS button paints a hard 4px offset shadow (`.btn-primary` /
 * `.btn-secondary`, `shadow-[0.25rem_0.25rem_0_...]`). A box-shadow is NOT part of
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
import { collectShadowClips, type ShadowClip } from '../utils/shadow-clip'
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

async function scan(page: Page, route: string): Promise<Array<ShadowClip & { route: string }>> {
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
    const found = await page.evaluate(collectShadowClips, {})
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

        const offenders: Array<ShadowClip & { route: string }> = []
        for (const route of ROUTES) {
            offenders.push(...(await scan(page, route)))
        }

        const report = offenders
            .map((o) => `  ${o.route}\n    ${o.button}\n    clipped by ${o.clippedBy} (over ${o.overflowBy})`)
            .join('\n')
        expect(offenders, `button shadows clipped at ${viewport.name}:\n${report}`).toEqual([])
    })
}
