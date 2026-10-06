/** The real signup plan, DS drawers and mobile scroll behavior; no provider writes. */
import { expect, test } from '@playwright/test'

const locales = ['en', 'es-419', 'es-AR', 'pt-BR'] as const
for (const locale of locales) {
    for (const width of [320, 375, 393, 430]) {
        test(`signup plan and drawers fit ${locale} at ${width}px`, async ({ page, context, baseURL }) => {
            await page.setViewportSize({ width, height: 667 })
            await context.addCookies([{ name: 'app-locale', value: locale, url: baseURL! }])
            await page.addInitScript(() => {
                sessionStorage.setItem('showNoMoreJailModal', 'true')
                localStorage.setItem('peanut_demo_activation_celebrated_at', '2026-01-01T00:00:00.000Z')
                localStorage.setItem(
                    'demo-user:user-preferences',
                    JSON.stringify({ hasSeenBalanceWarning: { value: true, expiry: 4102444800000 } })
                )
            })
            await page.route('**/*', (route) => {
                const { hostname } = new URL(route.request().url())
                return ['127.0.0.1', 'localhost'].includes(hostname) ? route.continue() : route.abort()
            })
            await page.goto('/dev/surfaces?s=03-h-funding-methods&__fixture=setup-payment-plan')
            const funding = page.getByTestId('setup-funding-channel')
            const payment = page.getByTestId('setup-payment-channel')
            await expect(funding).toBeVisible()
            await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
            await expect(funding).toHaveJSProperty('offsetHeight', 36)
            await funding.click()
            // Support keeps a closed dialog mounted; scope to the real DS drawer.
            const dialog = page.locator('[role="dialog"][data-vaul-drawer]')
            await expect(dialog).toBeVisible()
            // Both bank providers are offered, grouped by provider rather than currency rails.
            const rows = dialog.getByRole('button')
            await expect(rows).toHaveCount(4)
            const selected = await rows.nth(1).getAttribute('aria-label')
            await rows.nth(1).click()
            await expect(dialog).not.toBeVisible()
            await expect(funding).toHaveAttribute('aria-label', new RegExp(`${selected}$`))
            await funding.click()
            await expect(dialog.getByRole('button').nth(1)).toHaveCSS('background-color', 'rgb(220, 214, 255)')
            await page.keyboard.press('Escape')
            await expect(dialog).not.toBeVisible()
            await payment.click()
            await expect(dialog.getByRole('button')).toHaveCount(6)
            await dialog.getByRole('button').first().click()
            await expect(dialog).not.toBeVisible()
            await expect(payment).toHaveJSProperty('offsetHeight', 36)
            await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
            // The app permits vertical scrolling rather than clipping long translated copy.
            await payment.scrollIntoViewIfNeeded()
            await expect(payment).toBeInViewport()
        })
    }
}
