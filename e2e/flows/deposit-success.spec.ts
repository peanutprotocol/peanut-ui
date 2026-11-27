/**
 * HANDOFF rule 7: a Bridge one-time transfer that lands while its bank details
 * are up ends on the crypto deposit's success screen. The fixture answers each
 * history poll in turn (Fixture.sequences): open first, then done. Pesos have
 * their own success inside MantecaDepositShareDetails (TASK-25444).
 *
 * DEPOSIT_SHOTS_OUT writes a 375×667 capture of the success screen.
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
