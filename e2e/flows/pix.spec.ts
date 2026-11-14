/**
 * The one Pix flow, on Manteca's route: the deposit amount's minimum from the
 * route, the code with no expiry, payer or fee line, the key whose holder the
 * provider cannot check, and the form's rows. UI state only: every API answer
 * comes from a fixture (`?__fixture=pix-*`, src/dev/fixtures/registry.ts), so
 * nothing here reaches a provider or a chain. Backend truth (the price lock,
 * the payout) belongs to the API's integration tests and Nutcracker.
 */

import { expect, test, type Page } from '@playwright/test'
import { dismissModals } from '../utils/dismiss-modals'

test.use({ viewport: { width: 375, height: 667 } })

const WITHDRAW = '/withdraw/pix'

async function open(page: Page, url: string) {
    await page.goto(url, { waitUntil: 'domcontentloaded' })
    await page.addStyleTag({ content: '[data-fixture-banner]{display:none!important}' })
    await dismissModals(page)
}

test.describe('Pix on the Manteca route', () => {
    test('a deposit under R$1 says the minimum and cannot continue', async ({ page }) => {
        await open(page, '/add-money/pix?__fixture=pix-deposit-amount')
        const input = page.locator('input[inputmode="decimal"]').first()
        await expect(input).toBeVisible({ timeout: 60_000 })
        await input.fill('0.5')
        await expect(page.getByText('The minimum is R$1.')).toBeVisible()
        await expect(page.getByRole('button', { name: 'Continue' })).toBeDisabled()
        await input.fill('100')
        await expect(page.getByText('The minimum is R$1.')).toHaveCount(0)
        await expect(page.getByRole('button', { name: 'Continue' })).toBeEnabled()
        await expect(page.getByText('Provider · Manteca')).toBeVisible()
        // the code carries the amount, so the bank-transfer "must match" helper does not show
        await expect(page.getByText('This must exactly match what you send from your bank')).toHaveCount(0)
    })

    test('the code has no expiry, payer or fee line, and names Manteca', async ({ page }) => {
        await open(
            page,
            '/add-money/pix?step=showQR&intentId=fixture-pix-manteca-deposit&__fixture=pix-manteca-deposit-code'
        )
        await expect(page.getByText('R$100')).toBeVisible({ timeout: 60_000 })
        await expect(page.getByText(/^Code valid for/)).toHaveCount(0)
        await expect(page.getByText(/under your CPF/)).toHaveCount(0)
        await expect(page.getByText(/^Fee /)).toHaveCount(0)
        await expect(page.getByText('Provider · Manteca')).toBeVisible()
    })

    test('a key whose holder the provider cannot check shows no badge and continues', async ({ page }) => {
        await open(page, `${WITHDRAW}?destination=09579927189&__fixture=pix-manteca-withdraw-key`)
        const holder = page.getByTestId('pix-key-holder')
        await expect(holder).toBeVisible({ timeout: 60_000 })
        await expect(holder).toContainText('Ana Souza')
        await expect(holder).not.toContainText('Own account')
        await expect(holder).not.toContainText("Someone else's")
        await expect(page.getByRole('button', { name: 'Continue' })).toBeEnabled()
    })

    test('the form shows no flat-fee line and names Manteca', async ({ page }) => {
        await open(
            page,
            `${WITHDRAW}?destination=09579927189&destinationAmount=503&step=review&__fixture=pix-manteca-withdraw-review`
        )
        await expect(page.getByText('Withdrawing')).toBeVisible({ timeout: 60_000 })
        await expect(page.getByText('Ana Souza')).toBeVisible()
        await expect(page.getByText('Provider fee', { exact: true })).toHaveCount(0)
        await expect(page.getByText('1 USD = 5.437838 BRL')).toBeVisible()
        await expect(page.getByText('Manteca')).toBeVisible()
        await expect(page.getByRole('button', { name: 'Confirm' })).toBeEnabled()
    })
})
