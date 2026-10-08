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
            await page.evaluate(() => document.fonts.ready)
            const fundingWidth = await funding.evaluate((el) => el.getBoundingClientRect().width)
            const paymentWidth = await payment.evaluate((el) => el.getBoundingClientRect().width)
            await funding.click()
            // Support keeps a closed dialog mounted; scope to the real DS drawer.
            const dialog = page.locator('[role="dialog"][data-vaul-drawer]')
            await expect(dialog).toBeVisible()
            // Both bank providers are offered, grouped by provider rather than currency rails.
            const rows = dialog.getByRole('button')
            await expect(rows).toHaveCount(4)
            const selected = await rows.nth(1).getAttribute('aria-label')
            expect(selected).toBeTruthy()
            await rows.nth(1).click()
            await expect(dialog).not.toBeVisible()
            await expect(funding).toHaveAttribute(
                'aria-label',
                new RegExp(`${selected!.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`)
            )
            await expect(funding).not.toContainText(/[()]/)
            expect(await funding.evaluate((el) => el.getBoundingClientRect().width)).toBe(fundingWidth)
            await funding.click()
            await expect(dialog.getByRole('button').nth(1)).toHaveClass(/\bbg-background-selection\b/)
            await page.keyboard.press('Escape')
            await expect(dialog).not.toBeVisible()
            await payment.click()
            await expect(dialog.getByRole('button')).toHaveCount(5)
            await dialog.getByRole('button').nth(2).click()
            await expect(dialog).not.toBeVisible()
            await expect(payment).toHaveJSProperty('offsetHeight', 36)
            expect(await payment.evaluate((el) => el.getBoundingClientRect().width)).toBe(paymentWidth)
            await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
            // The app permits vertical scrolling rather than clipping long translated copy.
            await payment.scrollIntoViewIfNeeded()
            await expect(payment).toBeInViewport()
        })
    }
}

test('settles initial options without animating, then changes only the scheduled selector', async ({ page }) => {
    await page.addInitScript(() => {
        sessionStorage.setItem('showNoMoreJailModal', 'true')
        localStorage.setItem('peanut_demo_activation_celebrated_at', '2026-01-01T00:00:00.000Z')
        localStorage.setItem(
            'demo-user:user-preferences',
            JSON.stringify({ hasSeenBalanceWarning: { value: true, expiry: 4102444800000 } })
        )
    })
    await page.route('**/*', (route) =>
        ['127.0.0.1', 'localhost'].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort()
    )
    await page.goto('/dev/surfaces?s=03-h-funding-methods&__fixture=setup-payment-plan')
    const funding = page.getByTestId('setup-funding-channel')
    const payment = page.getByTestId('setup-payment-channel')
    await expect(funding).toHaveAttribute('aria-label', 'Add money with: Bank transfer (BRL)')
    await expect(payment).toHaveAttribute('aria-label', 'Make a payment with: Peanut card')
    const visibleLabels = 'span[title] > span:not([aria-hidden="true"])'
    await expect(funding.locator(visibleLabels)).toHaveCount(1)
    await expect(payment.locator(visibleLabels)).toHaveCount(1)
    await page.waitForTimeout(1000)
    await expect(funding).toHaveAttribute('aria-label', 'Add money with: Bank transfer (BRL)')
    await expect(funding).toHaveAttribute('aria-label', 'Add money with: Bank transfer (USD, EUR, GBP, MXN)', {
        timeout: 4000,
    })
    await expect(payment).toHaveAttribute('aria-label', 'Make a payment with: Peanut card')
    await expect(payment.locator(visibleLabels)).toHaveCount(1)
    await expect(payment).toHaveAttribute('aria-label', 'Make a payment with: Bank transfer', { timeout: 3000 })
    await funding.click()
    await page.waitForTimeout(4300)
    await expect(funding).toHaveAttribute('aria-label', 'Add money with: Bank transfer (USD, EUR, GBP, MXN)')
    await expect(payment).toHaveAttribute('aria-label', 'Make a payment with: Bank transfer')
})
