/**
 * Landing page during the pwa-sunset window: the layout gate.
 *
 * Every locale, at the two laptop sizes the hero was tuned for plus the md
 * breakpoint and a phone, with the flag off and on. Three assertions carry the
 * whole fold budget: the flag-on page actually rendered its lockup, nothing
 * scrolls sideways, and the yellow marquee under the hero is still above the
 * fold on a laptop. All three are what the CTA lockup can break, and none is
 * visible in a unit test.
 *
 * Two things this spec has to arrange for itself:
 *
 *  - The flag. It is read client-side through PostHog, which never initialises
 *    here (a CI build carries no NEXT_PUBLIC_POSTHOG_KEY), so `isPwaSunsetOn`
 *    honours `localStorage['pwa-sunset']` on every non-production domain. The
 *    positive assertions below exist so an override that ever goes inert fails
 *    loudly instead of quietly measuring the flag-off page.
 *  - The device. `useDeviceType` branches on the USER AGENT, not the viewport,
 *    and the shared project is a Pixel 7 — so a laptop viewport alone still
 *    rendered the phone CTA and never exercised the QR lockup the laptop
 *    constants were tuned for. The desktop cases override the UA.
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

const DESKTOP_UA =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

const VIEWPORTS = [
    { name: '1440x900', width: 1440, height: 900, desktop: true, marqueeInFold: true },
    { name: '1366x768', width: 1366, height: 768, desktop: true, marqueeInFold: true },
    // the md breakpoint exactly: the get-the-app fold's 3-up is tightest here
    { name: '768x1024', width: 768, height: 1024, desktop: true, marqueeInFold: false },
    { name: '390x844', width: 390, height: 844, desktop: false, marqueeInFold: false },
] as const

const slug = (route: string) => (route === '/' ? 'en' : route.replace(/\//g, ''))

async function gotoLanding(page: Page, route: string, flagOn: boolean) {
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

    for (const viewport of VIEWPORTS) {
        test.describe(viewport.name, () => {
            test.use(
                viewport.desktop
                    ? {
                          userAgent: DESKTOP_UA,
                          isMobile: false,
                          hasTouch: false,
                          deviceScaleFactor: 1,
                          viewport: { width: viewport.width, height: viewport.height },
                      }
                    : { viewport: { width: viewport.width, height: viewport.height } }
            )

            for (const flagOn of [false, true]) {
                for (const route of LOCALES) {
                    test(`${slug(route)}, flag ${flagOn ? 'on' : 'off'}`, async ({ page }) => {
                        await gotoLanding(page, route, flagOn)

                        if (flagOn) {
                            // Proof the override took AND that the right lockup
                            // rendered for this UA. Without it every assertion
                            // below passes on the flag-off page.
                            const lockup = page.getByTestId(viewport.desktop ? 'app-qr-code' : 'phone-app-cta').first()
                            await expect(lockup).toBeVisible()
                        } else {
                            // the flag-off hero keeps the content-system button,
                            // and neither lockup exists anywhere on the page
                            await expect(page.getByTestId('app-qr-code')).toHaveCount(0)
                            await expect(page.getByTestId('phone-app-cta')).toHaveCount(0)
                        }

                        await page.screenshot({
                            path: path.join(
                                SHOTS_OUT,
                                `${slug(route)}-${viewport.name}-flag-${flagOn ? 'on' : 'off'}.png`
                            ),
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
        })
    }

    test.describe('desktop CTA re-points', () => {
        test.use({
            userAgent: DESKTOP_UA,
            isMobile: false,
            hasTouch: false,
            deviceScaleFactor: 1,
            viewport: { width: 1440, height: 900 },
        })

        test('no signup or send url survives with the flag on', async ({ page }) => {
            await gotoLanding(page, '/', true)
            await expect(page.getByTestId('app-qr-code').first()).toBeVisible()

            const hrefs = await page.evaluate(() =>
                [...document.querySelectorAll('a[href]')].map((a) => a.getAttribute('href') ?? '')
            )
            expect(hrefs.filter((href) => href.startsWith('/setup'))).toEqual([])
            expect(hrefs.filter((href) => href === '/send')).toEqual([])
        })
    })
})
