/**
 * Landing page during the pwa-sunset window: the layout gate.
 *
 * Every locale, at the two laptop sizes the hero was tuned for plus a phone,
 * with the flag off and on. Two assertions carry the whole fold budget:
 * nothing scrolls sideways, and the yellow marquee under the hero is still
 * above the fold on a laptop. Both are what the CTA lockup can break, and
 * neither is visible in a unit test.
 *
 * Run it against a production build, like the other specs here:
 *   NEXT_PUBLIC_VERCEL_ENV=preview pnpm build
 *   pnpm test:e2e:regression -- landing-migration
 *
 * Screenshots land in LANDING_SHOTS_OUT (default e2e/__shots__/landing-migration).
 */
import { expect, test, type Page } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

const SHOTS_OUT = process.env.LANDING_SHOTS_OUT ?? 'e2e/__shots__/landing-migration'

// the four landing routes, by the path each locale is served on
const LOCALES = ['/', '/es-419', '/es-ar', '/pt-br'] as const

const VIEWPORTS = [
    { name: '1440x900', width: 1440, height: 900, marqueeInFold: true },
    { name: '1366x768', width: 1366, height: 768, marqueeInFold: true },
    { name: '390x844', width: 390, height: 844, marqueeInFold: false },
] as const

const slug = (route: string) => (route === '/' ? 'en' : route.replace(/\//g, ''))

async function gotoLanding(page: Page, route: string, flagOn: boolean) {
    // the flag is read client-side; IS_DEV/localStorage is the override the
    // migration utils expose for exactly this (isPwaSunsetOn).
    await page.addInitScript(
        ([on]) => {
            try {
                if (on) localStorage.setItem('pwa-sunset', 'true')
                else localStorage.removeItem('pwa-sunset')
            } catch {}
        },
        [flagOn]
    )
    await page.goto(route, { waitUntil: 'domcontentloaded' })
    // the migration branches only exist after mount, so wait for the hero to settle
    await page.locator('#hero').waitFor()
    await page.waitForTimeout(500)
}

/** true when the page can be scrolled sideways at all. */
const hasHorizontalOverflow = (page: Page) =>
    page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)

/** distance from the top of the viewport to the top of the first marquee strip,
 *  which is the element immediately after the hero section. */
const marqueeTop = (page: Page) =>
    page.evaluate(() => {
        const next = document.getElementById('hero')?.nextElementSibling
        return next ? next.getBoundingClientRect().top : Number.POSITIVE_INFINITY
    })

test.describe('landing page, pwa-sunset', () => {
    test.beforeAll(async () => {
        await mkdir(SHOTS_OUT, { recursive: true })
    })

    for (const flagOn of [false, true]) {
        for (const route of LOCALES) {
            for (const viewport of VIEWPORTS) {
                test(`${slug(route)} @ ${viewport.name}, flag ${flagOn ? 'on' : 'off'}`, async ({ page }) => {
                    await page.setViewportSize({ width: viewport.width, height: viewport.height })
                    await gotoLanding(page, route, flagOn)

                    await page.screenshot({
                        path: path.join(SHOTS_OUT, `${slug(route)}-${viewport.name}-flag-${flagOn ? 'on' : 'off'}.png`),
                    })

                    expect(await hasHorizontalOverflow(page)).toBe(false)

                    if (viewport.marqueeInFold) {
                        // the hero is tuned so the strip under it is visible without
                        // scrolling; that is the whole point of the artwork clamp
                        expect(await marqueeTop(page)).toBeLessThan(viewport.height)
                    }
                })
            }
        }
    }

    test('no signup or send url survives with the flag on', async ({ page }) => {
        await page.setViewportSize({ width: 1440, height: 900 })
        await gotoLanding(page, '/', true)

        const hrefs = await page.evaluate(() =>
            [...document.querySelectorAll('a[href]')].map((a) => a.getAttribute('href') ?? '')
        )
        expect(hrefs.filter((href) => href.startsWith('/setup'))).toEqual([])
        expect(hrefs.filter((href) => href === '/send')).toEqual([])
    })
})
