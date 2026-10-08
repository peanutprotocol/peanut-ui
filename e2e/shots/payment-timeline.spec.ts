import { test, expect } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'

for (const [fixture, current] of [
    ['history-payment-timeline', 'Payment complete'],
    ['history-payment-processing', 'Payment sent for payout'],
    ['history-payment-refunded', 'Payment refunded'],
] as const) {
    test(`payment receipt: ${fixture}`, async ({ page, baseURL }, testInfo) => {
        test.setTimeout(90_000)
        await page.route('**/*', (route) => {
            const { hostname } = new URL(route.request().url())
            return hostname === '127.0.0.1' || hostname === 'localhost' ? route.continue() : route.abort()
        })
        await page.context().addCookies([{ name: 'jwt-token', value: 'fixture', url: baseURL! }])
        await page.clock.setFixedTime(new Date('2026-08-15T12:00:00Z'))
        await page.addInitScript((fixtureName) => {
            window.sessionStorage.setItem('peanut_fixture', fixtureName)
            window.localStorage.setItem('peanut_demo_activation_celebrated_at', '2026-01-01T00:00:00.000Z')
            window.localStorage.setItem(
                'demo-user:user-preferences',
                JSON.stringify({
                    hasSeenBalanceWarning: { value: true, expiry: 4102444800000 },
                })
            )
            window.sessionStorage.setItem('user_geo_country_code', 'DE')
            window.sessionStorage.setItem(
                'user_geo_country_code_timestamp',
                String(new Date('2026-08-15T11:59:00Z').getTime())
            )
        }, fixture)
        await page.goto(`/history?tx=fixture-payment-timeline&__fixture=${fixture}`, { waitUntil: 'domcontentloaded' })
        const receipt = page.getByRole('dialog', { name: 'Transaction details' })
        await expect(receipt.getByRole('list', { name: 'Payment timeline' })).toBeVisible({ timeout: 45_000 })
        await expect(receipt.locator('[aria-current="step"]')).toContainText(current)
        if (fixture === 'history-payment-processing') {
            const final = receipt.locator('li[data-state="upcoming"]').last()
            await expect(final).toContainText('Payment complete')
            await expect(final.locator('time')).toHaveCount(0)
            await expect(final.locator('.bg-background-icon-bubble-gray')).toHaveCSS(
                'background-color',
                'rgb(209, 213, 219)'
            )
            await expect(receipt.locator('[aria-current="step"] .bg-background-icon-bubble-yellow')).toHaveCSS(
                'background-color',
                'rgb(255, 201, 0)'
            )
        }
        await expect(receipt.getByText('Funds received', { exact: true })).toBeVisible()
        // Check the actual rendered connector, not just a class name.
        const connector = receipt.locator('li span[aria-hidden="true"]').first()
        await expect(connector).toHaveCSS('background-color', 'rgb(156, 163, 175)')
        expect(await receipt.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true)
        await page.addStyleTag({ content: '[data-fixture-banner], nextjs-portal { display: none !important; }' })
        const output = process.env.SHOTS_OUT ?? '/tmp/payment-timeline-shots'
        await mkdir(output, { recursive: true })
        await receipt.screenshot({
            path: join(output, `${fixture}-receipt@${testInfo.project.name}.png`),
            animations: 'disabled',
        })
        await receipt.getByRole('tab', { name: 'Details', exact: true }).click()
        await expect(receipt.getByRole('tabpanel', { name: 'Details' })).toBeVisible()
        await expect(receipt.getByRole('list', { name: 'Payment timeline' })).toHaveCount(0)
    })
}
