/**
 * HANDOFF rule 7: a bank deposit that lands while its details are up ends on
 * the crypto deposit's success screen. The fixtures answer each status poll in
 * turn (Fixture.sequences): open first, then done, as a real deposit does.
 *
 * DEPOSIT_SHOTS_OUT writes a 375×667 capture of each success screen.
 */
import { expect, test, type Page } from '@playwright/test'

test.use({ storageState: { cookies: [], origins: [] }, viewport: { width: 375, height: 667 } })

async function shot(page: Page, name: string) {
    if (!process.env.DEPOSIT_SHOTS_OUT) return
    await page.evaluate(() => document.fonts.ready)
    await page.screenshot({
        path: `${process.env.DEPOSIT_SHOTS_OUT}/${name}.png`,
        animations: 'disabled',
        scale: 'css',
    })
}

test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
        ;(window as Window & { __screenCapture?: boolean }).__screenCapture = true
    })
})

test('a peso deposit that lands on screen ends on "Added $10"', async ({ page }) => {
    await page.route('**/api/geo-country', (route) =>
        route.fulfill({ json: { country: 'AR' }, headers: { 'access-control-allow-origin': '*' } })
    )
    await page.goto(
        '/add-money/argentina/manteca?step=inputAmount&amount=10000&currency=ARS&__fixture=add-money-argentina-deposit-received'
    )
    await page.getByTestId('deposit-amount-continue').click()

    // the details first, then the next 5 s poll completes the order
    await expect(page.getByText('fixture.deposit.test').first()).toBeVisible()
    await expect(page.getByRole('button', { name: 'See receipt' })).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText('Added', { exact: true })).toBeVisible()
    await expect(page.getByText('$10')).toBeVisible()
    await expect(page.getByText('ARS 10,000')).toBeVisible()
    await shot(page, 'pesos-received')
})

test('a Bridge one-time transfer that lands on screen ends on the success screen', async ({ page }) => {
    test.setTimeout(120_000)
    await page.goto('/add-money/germany/bank?step=inputAmount&amount=20&__fixture=add-money-bank-transfer-received')
    await page.getByRole('button', { name: 'Continue', exact: true }).click()
    const handle = page.getByRole('button', { name: 'Slide to proceed', exact: true })
    await expect(handle).toBeVisible()
    await handle.focus()
    for (let press = 0; press < 10; press++) await page.keyboard.press('ArrowRight')

    // the bank details first, then the next 15 s entry poll reads PAYMENT_PROCESSED
    await expect(page.getByText('Fixture Bank AG').first()).toBeVisible()
    await expect(page.getByRole('button', { name: 'See receipt' })).toBeVisible({ timeout: 40_000 })
    await expect(page.getByText('$21.62')).toBeVisible()
    await expect(page.getByText('€20')).toBeVisible()
    await shot(page, 'bridge-received')
})
