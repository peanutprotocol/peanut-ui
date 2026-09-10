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
                    await page.locator('#send-in-seconds').scrollIntoViewIfNeeded()
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
    test('hero, countries, rates and lower send reuse a dismissible modal', async ({ page }) => {
        await landing(page, '/', true)
        const entries = [
            page.getByTestId('landing-download-cta').getByRole('link'),
            page.locator('#global-cash a[href="/app"]'),
            page.locator('#no-fees').getByRole('button', { name: /send money/i }),
            page.locator('#send-in-seconds a[href="/app"]'),
        ]
        for (const [index, entry] of entries.entries()) {
            await entry.click()
            const dialog = page.getByRole('dialog')
            await expect(dialog).toBeVisible()
            await expect(dialog.getByAltText('qr center logo')).toBeVisible()
            await expect(dialog.locator('a[href*="apps.apple.com"]')).toBeVisible()
            await expect(dialog.locator('a[href*="play.google.com"]')).toBeVisible()
            if (index === 0)
                await page.screenshot({ path: path.join(shots, 'desktop-modal.png'), animations: 'disabled' })
            await page.keyboard.press('Escape')
            await expect(dialog).toHaveCount(0)
        }
    })
})
