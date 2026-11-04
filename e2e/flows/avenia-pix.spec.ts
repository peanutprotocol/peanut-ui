/**
 * Brazil Pix on Avenia for Brazilian residents: the first-use step, the
 * deposit amount's minimum, the own-key rule on the withdrawal key and the
 * review's rows. UI state only: every API answer comes from a fixture
 * (`?__fixture=avenia-*`, src/dev/fixtures/registry.ts), so nothing here
 * reaches Avenia, Rhino or a chain. Backend truth (tickets, the Rhino join,
 * the payout) belongs to the API's integration tests and Nutcracker.
 */

import { expect, test, type Page } from '@playwright/test'
import { dismissModals } from '../utils/dismiss-modals'

test.use({ viewport: { width: 375, height: 667 } })

const WITHDRAW = '/withdraw/manteca?method=bank-transfer&country=brazil'

async function open(page: Page, url: string) {
    await page.goto(url, { waitUntil: 'domcontentloaded' })
    await page.addStyleTag({ content: '[data-fixture-banner]{display:none!important}' })
    await dismissModals(page)
}

test.describe('Avenia Pix', () => {
    test("first use names Avenia and its terms before Avenia's verification opens", async ({ page }) => {
        await open(page, '/add-money/brazil/manteca?__fixture=avenia-first-use')
        await expect(page.getByText('Verify identity for Pix')).toBeVisible({ timeout: 60_000 })
        const terms = page.getByRole('link', { name: 'Avenia terms and conditions' })
        await expect(terms).toHaveAttribute('href', 'https://app.avenia.io/Avenia-TC.pdf')
        await expect(terms).toHaveAttribute('target', '_blank')
        await expect(page.getByText('Account provider · Avenia')).toBeVisible()
        await expect(page.getByRole('button', { name: 'Continue' })).toBeEnabled()
    })

    test('a deposit under R$20 says the minimum and cannot continue', async ({ page }) => {
        await open(page, '/add-money/brazil/manteca?__fixture=avenia-deposit-amount')
        const input = page.locator('input[inputmode="decimal"]').first()
        await expect(input).toBeVisible({ timeout: 60_000 })
        await input.fill('10')
        await expect(page.getByText('The minimum is R$20.')).toBeVisible()
        await expect(page.getByRole('button', { name: 'Continue' })).toBeDisabled()
        await input.fill('100')
        await expect(page.getByText('The minimum is R$20.')).toHaveCount(0)
        await expect(page.getByRole('button', { name: 'Continue' })).toBeEnabled()
        await expect(page.getByText('Provider · Avenia')).toBeVisible()
    })

    test("the user's own key resolves to holder and bank, and continues", async ({ page }) => {
        await open(page, `${WITHDRAW}&destination=09579927189&__fixture=avenia-withdraw-key`)
        const holder = page.getByTestId('avenia-pix-key-holder')
        await expect(holder).toBeVisible({ timeout: 60_000 })
        await expect(holder).toContainText('Ana Souza')
        await expect(holder).toContainText('Banco Inter · CPF 095.***.***-89')
        await expect(holder).toContainText('Own account')
        await expect(page.getByRole('button', { name: 'Continue' })).toBeEnabled()
    })

    test("someone else's key shows as such, with the field error, and cannot continue", async ({ page }) => {
        await open(page, `${WITHDRAW}&destination=%2B5511987654321&__fixture=avenia-withdraw-key-other`)
        const holder = page.getByTestId('avenia-pix-key-holder')
        await expect(holder).toBeVisible({ timeout: 60_000 })
        await expect(holder).toContainText("Someone else's")
        await expect(page.getByRole('alert')).toContainText('This key belongs to someone else.')
        await expect(page.getByRole('button', { name: 'Continue' })).toBeDisabled()
    })

    test('the review leads with the reais and shows one provider fee', async ({ page }) => {
        await open(
            page,
            `${WITHDRAW}&destination=09579927189&destinationAmount=503&step=review&__fixture=avenia-withdraw-review`
        )
        await expect(page.getByText('R$503')).toBeVisible({ timeout: 60_000 })
        await expect(page.getByText('to Banco Inter · Ana Souza')).toBeVisible()
        await expect(page.getByText('Provider fee')).toHaveCount(1)
        await expect(page.getByText('R$4.83')).toBeVisible()
        await expect(page.getByText('$92.50')).toBeVisible()
        await expect(page.getByRole('button', { name: 'Confirm' })).toBeEnabled()
        await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible()
    })
})
