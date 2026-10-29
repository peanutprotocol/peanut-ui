import { expect, test, type Page } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

const desktopUA =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
const iphoneUA =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
const shots = process.env.LANDING_SHOTS_OUT ?? 'e2e/__shots__/landing-app-entry'
async function landing(page: Page, route: string, on: boolean) {
    await page.addInitScript((on) => {
        if (on) localStorage.setItem('pwa-sunset', 'true')
        else localStorage.removeItem('pwa-sunset')
    }, on)
    await page.goto(route, { waitUntil: 'domcontentloaded' })
    await expect(page.locator('#hero')).toBeVisible()
    if (on) await expect(page.getByTestId('landing-download-cta')).toBeVisible()
    else await expect(page.locator('#hero a[href="/setup?step=login"]')).toBeVisible()
}
test.beforeAll(async () => {
    await mkdir(shots, { recursive: true })
})
for (const device of ['desktop', 'iphone', 'android'] as const) {
    test.describe(device, () => {
        test.use(
            device === 'desktop'
                ? {
                      userAgent: desktopUA,
                      isMobile: false,
                      hasTouch: false,
                      deviceScaleFactor: 1,
                      viewport: { width: 1440, height: 900 },
                  }
                : device === 'iphone'
                  ? { userAgent: iphoneUA, viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 }
                  : { viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 }
        )
        for (const route of ['/', '/es-419', '/es-ar', '/pt-br']) {
            for (const on of [false, true]) {
                test(`${route} flag ${on}`, async ({ page }) => {
                    const errors: string[] = []
                    page.on('pageerror', (error) => errors.push(error.message))
                    await landing(page, route, on)
                    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
                    if (on) {
                        const cta = page.getByTestId('landing-download-cta')
                        await expect(cta.getByRole('link')).toHaveCount(1)
                        await expect(page.getByRole('dialog')).toHaveCount(0)
                        await expect(page.locator('a[href^="/setup"], a[href="/send"]')).toHaveCount(0)
                        if (device !== 'desktop') {
                            await expect(cta.getByRole('link')).toHaveAttribute(
                                'href',
                                device === 'iphone' ? /apps.apple.com/ : /play.google.com/
                            )
                        }
                    } else {
                        await expect(page.getByTestId('landing-download-cta')).toHaveCount(0)
                    }
                    await page.screenshot({
                        path: path.join(
                            shots,
                            `${device}-${route === '/' ? 'en' : route.slice(1)}-${on ? 'on' : 'off'}.png`
                        ),
                        animations: 'disabled',
                    })
                    await page.locator('#home-close').scrollIntoViewIfNeeded()
                    await page.mouse.wheel(0, 500)
                    expect(await page.evaluate(() => document.body.style.overflow)).not.toBe('hidden')
                    expect(errors.filter((error) => /hydration|#418|#423|#425/i.test(error))).toEqual([])
                })
            }
        }
    })
}

test.describe('desktop entry points', () => {
    test.use({
        userAgent: desktopUA,
        isMobile: false,
        hasTouch: false,
        deviceScaleFactor: 1,
        viewport: { width: 1440, height: 900 },
    })
    test('server-renders the feature directory on the English landing alias', async ({ request }) => {
        const response = await request.get('/lp')

        expect(response.ok()).toBe(true)
        expect(await response.text()).toMatch(/<nav[^>]*\bid="footer-features"/)
    })

    test('card feature exploration lands on the complete directory', async ({ page }) => {
        await page.goto('/peanut-card', { waitUntil: 'domcontentloaded' })
        await page.getByRole('link', { name: 'Explore all features' }).click()

        await expect(page).toHaveURL(/\/lp#footer-features$/)
        const directory = page.locator('nav#footer-features')
        await expect(directory.getByRole('link')).toHaveCount(6)
        await expect(directory).toBeInViewport({ ratio: 1 })
    })

    test('hero, account pair and close CTA reuse a dismissible modal', async ({ page }) => {
        await landing(page, '/', true)
        const entries = [
            page.getByTestId('landing-download-cta').getByRole('link'),
            page.locator('#home-get-paid a[href="/app"]'),
            page.locator('#home-close a[href="/app"]'),
        ]
        const placements = ['hero', 'artwork', 'app-fold']
        for (const [index, entry] of entries.entries()) {
            await entry.click()
            const dialog = page.getByRole('dialog')
            await expect(dialog).toBeVisible()
            await expect(dialog.getByRole('img', { name: 'Scan with your phone camera to download.' })).toBeVisible()
            await expect(dialog.locator('[data-qr-url]')).toHaveAttribute(
                'data-qr-url',
                new RegExp(`/home\\?mqr=home-${placements[index]}-en(?:&|$)`)
            )
            await expect(dialog.locator('a[href*="apps.apple.com"]')).toBeVisible()
            await expect(dialog.locator('a[href*="play.google.com"]')).toBeVisible()
            if (index === 0)
                await page.screenshot({ path: path.join(shots, 'desktop-modal.png'), animations: 'disabled' })
            await page.keyboard.press('Escape')
            await expect(dialog).toHaveCount(0)
        }
    })
})
