/**
 * The one Pix flow, on the route of either provider: Avenia's terms (TASK-25073), the first use
 * and what it still asks, the deposit amount's minimum from the route, the withdrawal key and a send to another person's key
 * (TASK-24947: any key is paid), the form's rows, the send's ending and receipt, and a resident
 * of another country on Avenia; then the same screens on Manteca's route, where the answers
 * differ; and a merchant Pix code paid on Avenia's pay route (M4). UI state only:
 * every API answer comes from a fixture (`?__fixture=pix-*`,
 * src/dev/fixtures/registry.ts), so nothing here reaches a provider or a chain.
 * Backend truth (tickets, the bridge join, the payout) belongs to the API's
 * integration tests and Nutcracker.
 */

import { expect, test, type Page } from '@playwright/test'
import { dismissModals } from '../utils/dismiss-modals'

test.use({ viewport: { width: 375, height: 667 } })

const WITHDRAW = '/withdraw/pix'
const SEND = '/withdraw/pix?sendMethod=bank'

async function open(page: Page, url: string) {
    await page.goto(url, { waitUntil: 'domcontentloaded' })
    await page.addStyleTag({ content: '[data-fixture-banner]{display:none!important}' })
    await dismissModals(page)
}

test.describe('Pix on the Avenia route', () => {
    // TASK-24947: Avenia relies on our verification, so its first use has no tap and no terms
    test("the first use opens Avenia's account with no tap and no terms", async ({ page }) => {
        await page.addInitScript(() => {
            ;(window as Window & { __fixtureRequests?: string[] }).__fixtureRequests = []
        })
        await open(page, '/add-money/pix?__fixture=pix-first-use')
        await expect(page.getByText('Our payment partner is checking your verification.')).toBeVisible({
            timeout: 60_000,
        })
        await expect
            .poll(() =>
                page.evaluate(() => (window as Window & { __fixtureRequests?: string[] }).__fixtureRequests ?? [])
            )
            .toContain('POST /users/kyc/features/pix/activate')
        await expect(page.getByRole('button', { name: 'Continue' })).toHaveCount(0)
        await expect(page.getByRole('link', { name: 'Avenia terms and conditions' })).toHaveCount(0)
    })

    // TASK-25073: Avenia's terms, accepted once at Pix setup
    test("the terms step names and links Avenia's terms before the user accepts them", async ({ page }) => {
        await open(page, '/add-money/pix?__fixture=pix-setup-terms')
        await expect(page.getByText('Set up Pix')).toBeVisible({ timeout: 60_000 })
        const terms = page.getByRole('link', { name: 'Avenia terms and conditions' })
        await expect(terms).toHaveAttribute('href', 'https://app.avenia.io/Avenia-TC.pdf')
        await expect(terms).toHaveAttribute('target', '_blank')
        await expect(page.getByText('Account provider · Avenia')).toBeVisible()
        await expect(page.getByRole('button', { name: 'Agree and continue' })).toBeEnabled()
    })

    test("an Avenia account opened before the terms step meets Avenia's terms at its next withdrawal", async ({
        page,
    }) => {
        await open(page, `${WITHDRAW}?__fixture=pix-withdraw-terms`)
        await expect(page.getByRole('link', { name: 'Avenia terms and conditions' })).toBeVisible({ timeout: 60_000 })
        await expect(page.getByRole('textbox', { name: 'Pix key' })).toHaveCount(0)
    })

    test("a missing address is asked on the Pix page, with the state picked from Brazil's list", async ({ page }) => {
        await open(page, '/add-money/pix?__fixture=pix-setup-address-missing')
        const state = page.getByRole('combobox', { name: 'State or region' })
        await expect(state).toBeVisible({ timeout: 60_000 })
        await expect(state.locator('option', { hasText: 'Paraíba' })).toHaveAttribute('value', 'PB')
        await state.selectOption('PB')
        await expect(state).toHaveValue('PB')
        await expect(page.getByRole('textbox', { name: 'State or region' })).toHaveCount(0)
    })

    test('a missing CPF is asked on the Pix page', async ({ page }) => {
        await open(page, '/add-money/pix?__fixture=pix-setup-cpf-missing')
        await expect(page.getByTestId('verify-input-taxId')).toBeVisible({ timeout: 60_000 })
    })

    test('a deposit under R$20 says the minimum and cannot continue', async ({ page }) => {
        await open(page, '/add-money/pix?__fixture=pix-deposit-amount')
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
        await open(page, `${WITHDRAW}?destination=11144477735&__fixture=pix-withdraw-key`)
        const holder = page.getByTestId('pix-key-holder')
        await expect(holder).toBeVisible({ timeout: 60_000 })
        await expect(holder).toContainText('Ana Souza')
        await expect(holder).toContainText('Banco Inter · CPF 111.***.***-35')
        await expect(holder).toContainText('Own account')
        await expect(page.getByRole('button', { name: 'Continue' })).toBeEnabled()
    })

    // TASK-24947: Avenia pays another person's key, so the key continues as a send to them
    test("another person's key names the holder, bank and masked CPF, and continues as a send", async ({ page }) => {
        await open(page, `${SEND}&destination=%2B5511987654321&__fixture=pix-withdraw-key-other`)
        const holder = page.getByTestId('pix-key-holder')
        await expect(holder).toBeVisible({ timeout: 60_000 })
        await expect(holder).toContainText('Bruno Lima')
        await expect(holder).toContainText('Nubank · CPF ***.456.789-**')
        await expect(holder).not.toContainText('Own account')
        await expect(page.getByRole('button', { name: 'Continue' })).toBeEnabled()
    })

    test("the send's form leads with Sending, the holder and the phone key as people write it", async ({ page }) => {
        await open(
            page,
            `${SEND}&destination=%2B5511987654321&destinationAmount=100&step=review&__fixture=pix-send-review`
        )
        await expect(page.getByText('Sending', { exact: true })).toBeVisible({ timeout: 60_000 })
        await expect(page.getByText('Bruno Lima')).toBeVisible()
        await expect(page.getByText(/^11 98765-4321/)).toBeVisible()
        await expect(page.getByText('Nubank')).toBeVisible()
        await expect(page.getByRole('button', { name: 'Confirm' })).toBeEnabled()
    })

    test('a paid send ends as Sent, to the holder by name', async ({ page }) => {
        await open(
            page,
            '/withdraw/pix?step=success&intentId=fixture-pix-send&sendMethod=bank&__fixture=pix-send-arrived'
        )
        await expect(page.getByText('Sent', { exact: true })).toBeVisible({ timeout: 60_000 })
        await expect(page.getByText('to Bruno Lima')).toBeVisible()
    })

    test("the send's receipt names the holder and the Pix key, punctuated", async ({ page }) => {
        await open(page, '/history?tx=fixture-pix-send&__fixture=pix-receipt-send')
        await expect(page.getByText('Pix key', { exact: true })).toBeVisible({ timeout: 60_000 })
        await expect(page.getByText('11 98765-4321').first()).toBeVisible()
        await expect(page.getByText('Bruno Lima').first()).toBeVisible()
    })

    // a refused payout returns the money (API-CONTRACT-M3 §6): an old new-key link opens its outcome
    test('the retired new-key link opens the withdrawal, whose money came back', async ({ page }) => {
        await open(page, '/withdraw/new-pix-key?intentId=fixture-pix-withdrawal&__fixture=pix-withdraw-refunded')
        await expect(page.getByText('The bank refused this payout. The money is back in your balance.')).toBeVisible({
            timeout: 60_000,
        })
        await expect(page).toHaveURL(/\/withdraw\/pix\?intentId=fixture-pix-withdrawal/)
    })

    // the Pix-key payment form, with Withdrawing and Confirm (ruling 2026-11-12)
    test('the form leads with the key holder, offers to save the key, shows Avenia’s own rate and every fee as one row', async ({
        page,
    }) => {
        await open(
            page,
            `${WITHDRAW}?destination=11144477735&destinationAmount=503&step=review&__fixture=pix-withdraw-review`
        )
        await expect(page.getByText('Withdrawing')).toBeVisible({ timeout: 60_000 })
        await expect(page.getByText('Ana Souza')).toBeVisible()
        await expect(page.getByText('Banco Inter')).toBeVisible()
        await expect(page.getByText('Save to favorites')).toBeVisible()
        await expect(page.getByText('Provider fee', { exact: true })).toHaveCount(1)
        // the owner, 15 Nov, "Option A": every fee, not the flat R$0.75 alone, and Avenia's rate with no fee in it
        await expect(page.getByText('R$2.07')).toBeVisible()
        await expect(page.getByText('R$0.75')).toHaveCount(0)
        await expect(page.getByText('1 USD = 5.46 BRL')).toBeVisible()
        await expect(page.getByText('Sponsored by Peanut!')).toBeVisible()
        // the exact wallet debit the quote names, never the field's estimate
        await expect(page.getByText('$92.50')).toBeVisible()
        await expect(page.getByText('Save vs card')).toHaveCount(0)
        await expect(page.getByRole('button', { name: 'Confirm' })).toBeEnabled()
    })
})

// API-CONTRACT-M3: a resident of another country inside Avenia's gate sends by Pix on Avenia
test.describe('Pix on the Avenia route, for a resident of another country', () => {
    test('Send to a Pix key reaches the same key step, and the key continues', async ({ page }) => {
        await open(page, `${SEND}&destination=%2B5511987654321&__fixture=pix-nonresident-send-key`)
        const holder = page.getByTestId('pix-key-holder')
        await expect(holder).toBeVisible({ timeout: 60_000 })
        await expect(holder).toContainText('Bruno Lima')
        await expect(page.getByRole('button', { name: 'Continue' })).toBeEnabled()
    })
})

test.describe('Pix on the Manteca route', () => {
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
        await open(page, `${WITHDRAW}?destination=11144477735&__fixture=pix-manteca-withdraw-key`)
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
            `${WITHDRAW}?destination=11144477735&destinationAmount=503&step=review&__fixture=pix-manteca-withdraw-review`
        )
        await expect(page.getByText('Withdrawing')).toBeVisible({ timeout: 60_000 })
        await expect(page.getByText('Ana Souza')).toBeVisible()
        await expect(page.getByText('Provider fee', { exact: true })).toHaveCount(0)
        await expect(page.getByText('1 USD = 5.44 BRL')).toBeVisible()
        // exact: the fixture banner's name holds the word too
        await expect(page.getByText('Manteca', { exact: true })).toBeVisible()
        await expect(page.getByRole('button', { name: 'Confirm' })).toBeEnabled()
    })
})

// API-CONTRACT-M4: a merchant Pix code whose pay route names Avenia goes through the neutral pay routes
test.describe('A merchant Pix code on the Avenia route', () => {
    const FIXED =
        '00020101021226680014br.gov.bcb.pix2546pix.example.com/qr/v2/cobv/padaria-pao-dourado520400005303986540542.505802BR5924PADARIA PAO DOURADO LTDA6009SAO PAULO62070503***63043A47'
    const OPEN =
        '00020101021226680014br.gov.bcb.pix2546pix.example.com/qr/v2/cobv/padaria-pao-dourado5204000053039865802BR5924PADARIA PAO DOURADO LTDA6009SAO PAULO62070503***630409BC'
    const SMALL =
        '00020101021226680014br.gov.bcb.pix2546pix.example.com/qr/v2/cobv/padaria-pao-dourado52040000530398654043.005802BR5924PADARIA PAO DOURADO LTDA6009SAO PAULO62070503***63044A84'
    const qrPay = (code: string, fixture: string, intentId?: string) =>
        `/qr-pay?qrCode=${encodeURIComponent(code)}&type=PIX&t=1${intentId ? `&intentId=${intentId}` : ''}&__fixture=${fixture}`
    const requests = (page: Page) =>
        page.evaluate(() => (window as Window & { __fixtureRequests?: string[] }).__fixtureRequests ?? [])

    test.beforeEach(async ({ page }) => {
        await page.addInitScript(() => {
            ;(window as Window & { __fixtureRequests?: string[] }).__fixtureRequests = []
        })
    })

    test('a code with its own amount: the QR form with the merchant, the provider fee and Avenia, and no Manteca call', async ({
        page,
    }) => {
        await open(page, qrPay(FIXED, 'qr-pay-avenia-form'))
        await expect(page.getByText('PADARIA PAO DOURADO LTDA')).toBeVisible({ timeout: 60_000 })
        await expect(page.getByText('Paying')).toBeVisible()
        await expect(page.getByText('Provider fee', { exact: true })).toBeVisible()
        await expect(page.getByText('R$0.75')).toBeVisible()
        await expect(page.getByText('Avenia', { exact: true })).toBeVisible()
        expect(await requests(page)).toContain('POST /pix/pay/preview')
        expect((await requests(page)).some((call) => call.includes('/manteca/qr-payment'))).toBe(false)
    })

    test('under the R$5 minimum the minimum line shows, Pay stays off and nothing is opened', async ({ page }) => {
        await open(page, qrPay(SMALL, 'qr-pay-avenia-minimum'))
        await expect(page.getByText('The minimum is R$5.')).toBeVisible({ timeout: 60_000 })
        await expect(page.getByRole('button', { name: 'Pay', exact: true })).toBeDisabled()

        await open(page, qrPay(OPEN, 'qr-pay-avenia-open-amount'))
        const input = page.locator('input[inputmode="decimal"]').first()
        await expect(input).toBeVisible({ timeout: 60_000 })
        await input.fill('4')
        await expect(page.getByText('The minimum is R$5.')).toBeVisible()
        await expect(page.getByRole('button', { name: 'Pay', exact: true })).toBeDisabled()
        await page.waitForTimeout(1_000)
        // the code is read once without an amount; R$4 is never sent
        expect((await requests(page)).filter((call) => call === 'POST /pix/pay/preview')).toHaveLength(1)
        expect(await requests(page)).not.toContain('POST /pix/pay')

        await input.fill('50')
        await expect(page.getByText('The minimum is R$5.')).toHaveCount(0)
        await expect(page.getByText('PADARIA PAO DOURADO LTDA')).toBeVisible()
    })

    test('no Avenia account yet: the account opens with no tap, as on the other Pix pages', async ({ page }) => {
        await open(page, qrPay(FIXED, 'qr-pay-avenia-first-use'))
        await expect(page.getByText('Our payment partner is checking your verification.')).toBeVisible({
            timeout: 60_000,
        })
        await expect.poll(() => requests(page)).toContain('POST /users/kyc/features/pix/activate')
    })

    test('a user Avenia refused is sent to support, never to Manteca', async ({ page }) => {
        await open(page, qrPay(FIXED, 'qr-pay-avenia-refused'))
        await expect(page.getByRole('button', { name: 'Contact support' })).toBeVisible({ timeout: 60_000 })
        expect((await requests(page)).some((call) => call.includes('/manteca/qr-payment'))).toBe(false)
    })

    test('an opened payment shows how it ended: paid, or refunded', async ({ page }) => {
        await open(page, qrPay(FIXED, 'qr-pay-avenia-paid', 'fixture-qr-avenia'))
        await expect(page.getByText('Paid to PADARIA PAO DOURADO LTDA')).toBeVisible({ timeout: 60_000 })
        await expect(page.getByText('BRL 42.50')).toBeVisible()

        await open(page, qrPay(FIXED, 'qr-pay-avenia-refunded', 'fixture-qr-avenia'))
        await expect(page.getByText('Payment refunded')).toBeVisible({ timeout: 60_000 })
    })

    test("the payment's receipt reads as a QR payment to the merchant, with Avenia as the provider", async ({
        page,
    }) => {
        await open(page, '/history?tx=fixture-qr-avenia&__fixture=qr-pay-avenia-receipt')
        await expect(page.getByText('Paid to Padaria Pao Dourado Ltda')).toBeVisible({ timeout: 60_000 })
        await expect(page.getByText('Avenia', { exact: true })).toBeVisible()
    })
})
