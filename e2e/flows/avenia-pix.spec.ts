/**
 * Brazil Pix on Avenia for Brazilian residents: the first-use step, the
 * deposit amount's minimum, the own-key rule on the withdrawal key, the
 * review's rows, and the new key for a payout the bank refused. UI state only: every API answer comes from a fixture
 * (`?__fixture=avenia-*`, src/dev/fixtures/registry.ts), so nothing here
 * reaches Avenia, Rhino or a chain. Backend truth (tickets, the Rhino join,
 * the payout) belongs to the API's integration tests and Nutcracker.
 */

import { expect, test, type Page } from '@playwright/test'
import { dismissModals } from '../utils/dismiss-modals'

test.use({ viewport: { width: 375, height: 667 } })

const WITHDRAW = '/withdraw/pix'
const NEW_KEY = '/withdraw/new-pix-key?intentId=fixture-avenia-refused-withdrawal'

async function open(page: Page, url: string) {
    await page.goto(url, { waitUntil: 'domcontentloaded' })
    await page.addStyleTag({ content: '[data-fixture-banner]{display:none!important}' })
    await dismissModals(page)
}

test.describe('Avenia Pix', () => {
    test("the terms step names and links Avenia's terms before the user accepts them", async ({ page }) => {
        await open(page, '/add-money/pix?__fixture=avenia-first-use')
        await expect(page.getByText('Set up Pix')).toBeVisible({ timeout: 60_000 })
        const terms = page.getByRole('link', { name: 'Avenia terms and conditions' })
        await expect(terms).toHaveAttribute('href', 'https://app.avenia.io/Avenia-TC.pdf')
        await expect(terms).toHaveAttribute('target', '_blank')
        await expect(page.getByText('Account provider · Avenia')).toBeVisible()
        await expect(page.getByRole('button', { name: 'Continue' })).toBeEnabled()
    })

    test('a deposit under R$20 says the minimum and cannot continue', async ({ page }) => {
        await open(page, '/add-money/pix?__fixture=avenia-deposit-amount')
        const input = page.locator('input[inputmode="decimal"]').first()
        await expect(input).toBeVisible({ timeout: 60_000 })
        await input.fill('10')
        await expect(page.getByText('The minimum is R$20.')).toBeVisible()
        await expect(page.getByRole('button', { name: 'Continue' })).toBeDisabled()
        await input.fill('100')
        await expect(page.getByText('The minimum is R$20.')).toHaveCount(0)
        await expect(page.getByRole('button', { name: 'Continue' })).toBeEnabled()
        await expect(page.getByText('Provider · Avenia')).toBeVisible()
        // the code carries the amount, so the bank-transfer "must match" helper does not show
        await expect(page.getByText('This must exactly match what you send from your bank')).toHaveCount(0)
    })

    test("the user's own key resolves to holder and bank, and continues", async ({ page }) => {
        await open(page, `${WITHDRAW}?destination=09579927189&__fixture=avenia-withdraw-key`)
        const holder = page.getByTestId('avenia-pix-key-holder')
        await expect(holder).toBeVisible({ timeout: 60_000 })
        await expect(holder).toContainText('Ana Souza')
        await expect(holder).toContainText('Banco Inter · CPF 095.***.***-89')
        await expect(holder).toContainText('Own account')
        await expect(page.getByRole('button', { name: 'Continue' })).toBeEnabled()
    })

    test("someone else's key shows as such, with the field error, and cannot continue", async ({ page }) => {
        await open(page, `${WITHDRAW}?destination=%2B5511987654321&__fixture=avenia-withdraw-key-other`)
        const holder = page.getByTestId('avenia-pix-key-holder')
        await expect(holder).toBeVisible({ timeout: 60_000 })
        await expect(holder).toContainText("Someone else's")
        await expect(page.getByRole('alert').filter({ hasText: 'This key belongs to someone else.' })).toBeVisible()
        await expect(page.getByRole('button', { name: 'Continue' })).toBeDisabled()
    })

    test("the review leads with the reais, puts the fees in the rate and shows Avenia's flat fee apart", async ({
        page,
    }) => {
        await open(
            page,
            `${WITHDRAW}?destination=09579927189&destinationAmount=503&step=review&__fixture=avenia-withdraw-review`
        )
        await expect(page.getByText('R$503')).toBeVisible({ timeout: 60_000 })
        await expect(page.getByText('to Banco Inter · Ana Souza')).toBeVisible()
        await expect(page.getByText('Avenia fee')).toHaveCount(1)
        await expect(page.getByText('R$0.75')).toBeVisible()
        await expect(page.getByText('1 USD = BRL 5.445946')).toBeVisible()
        await expect(page.getByText('About 1 minute')).toBeVisible()
        await expect(page.getByText('$92.50')).toBeVisible()
        await expect(page.getByRole('button', { name: 'Confirm' })).toBeEnabled()
        await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible()
    })

    test("a refused payout's receipt asks for another key and opens the new-key screen", async ({ page }) => {
        await open(page, '/history?tx=fixture-avenia-refused-withdrawal&__fixture=avenia-receipt-new-key')
        const notice = page.getByTestId('avenia-new-key-notice')
        await expect(notice).toBeVisible({ timeout: 60_000 })
        await expect(notice).toContainText('The bank refused this payout.')
        await notice.getByRole('button', { name: 'Add Pix key' }).click()
        await expect(page).toHaveURL(/\/withdraw\/new-pix-key\?intentId=fixture-avenia-refused-withdrawal/)
    })

    test('a new own key for a refused payout is saved and says where the money goes', async ({ page }) => {
        await open(page, `${NEW_KEY}&destination=09579927189&__fixture=avenia-new-key`)
        await expect(page.getByText('The bank refused the payout to the previous key.')).toBeVisible({
            timeout: 60_000,
        })
        await expect(page.getByTestId('avenia-pix-key-holder')).toContainText('Own account')
        await page.getByRole('button', { name: 'Continue' }).click()
        await expect(page.getByText('Pix key saved')).toBeVisible()
        await expect(page.getByText('The money will be sent to Banco Inter · Ana Souza.')).toBeVisible()
    })

    test('the new-key link of a withdrawal that no longer waits shows its current state', async ({ page }) => {
        await open(page, `${NEW_KEY}&__fixture=avenia-new-key-not-waiting`)
        const state = page.getByTestId('avenia-new-key-not-waiting')
        await expect(state).toBeVisible({ timeout: 60_000 })
        await expect(state).toContainText('This withdrawal is no longer waiting for a new Pix key.')
        await expect(state).toContainText('Completed')
        await expect(page.getByRole('button', { name: 'Continue' })).toHaveCount(0)
    })
})
