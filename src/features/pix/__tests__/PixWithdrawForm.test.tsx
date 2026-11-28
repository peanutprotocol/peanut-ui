/** @jest-environment jsdom */
import { screen } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import en from '@/i18n/app/messages/en.json'
import { PROVIDERS } from '@/constants/providers.consts'

// general.utils reaches the viem clients, whose RPC-ranking timers keep the worker alive
jest.mock('@/app/actions/clients', () => ({}))
jest.mock('@/components/Global/NavHeader', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Provider/ProviderHelp', () => ({
    ProviderHelp: ({ providerId }: { providerId: string }) => <span>help {providerId}</span>,
}))

import { PixWithdrawForm } from '../components/PixWithdrawForm'

const display = {
    amountBrl: '503.00',
    pixKey: '11144477735',
    ownAccount: true as const,
    holderTaxIdMasked: null,
    holderName: 'Ana Souza',
    bankName: 'Banco Inter',
    withdrawUsd: '92.504310',
    rate: '5.445692',
    fixedFeeBrl: '0.75',
    // the variable fees in the rate, the flat fee as the row: 92.504310 × 5.445692 − 0.75 = R$503.00
    exchangeRate: '5.445692',
    providerFeeBrl: '0.75',
    arrivalEstimateSeconds: 60,
    provider: 'Avenia' as const,
}
const noop = () => {}
const save = { savedName: null, isOffered: false, checked: false, nickname: '', setChecked: noop, setNickname: noop }
const amount = {
    seed: { amount: '503', denomination: 'BRL' as const },
    price: 5.4,
    // the minimum's quote: its rate, and a fee that is not the user's
    rateAndFee: { exchangeRate: 5.37, providerFeeBrl: '0.98' },
    isLoading: false,
    isError: false,
    onRetry: noop,
    disabled: false,
    onBrlChange: noop,
    onUsdChange: noop,
    onBalanceFilled: noop,
    onAmountTyped: noop,
}
const renderForm = (props: Partial<Parameters<typeof PixWithdrawForm>[0]> = {}) =>
    renderWithIntl(
        <PixWithdrawForm
            title="Withdraw"
            onBack={noop}
            recipient={{
                pixKey: display.pixKey,
                holderName: 'Ana Souza',
                bankName: 'Banco Inter',
                taxIdMasked: null,
                ownAccount: true,
            }}
            save={save}
            amount={amount}
            display={display}
            total="$92.50"
            providerId="avenia-br"
            error={null}
            isSubmitting={false}
            canConfirm
            onConfirm={noop}
            {...props}
        />
    )

describe('PixWithdrawForm', () => {
    // the Pix-key payment form, with the withdrawal's lead word and button (ruling 2026-11-12)
    it('leads with Withdrawing, the holder, their CPF and bank; then the rate, the sponsored Peanut fee, the flat provider fee, the exact total and the provider', () => {
        renderForm()
        expect(screen.getByText(en.pix.withdraw.withdrawing)).toBeInTheDocument()
        expect(screen.getByText('Ana Souza')).toBeInTheDocument()
        // a CPF key is the holder's own tax ID: shown once, punctuated
        expect(screen.getByText('CPF 111.444.777-35')).toBeInTheDocument()
        expect(screen.getByText('Banco Inter')).toBeInTheDocument()
        // the review's rate, the variable fees inside (TASK-24967)
        expect(screen.getByText('1 USD = 5.45 BRL')).toBeInTheDocument()
        expect(screen.queryByText(en.common.peanutFee)).toBeNull()
        expect(screen.queryByText(en.common.sponsoredByPeanut)).toBeNull()
        expect(screen.getByText(en.pix.withdraw.fee)).toBeInTheDocument()
        // the flat fee alone
        expect(screen.getByText('R$0.75')).toBeInTheDocument()
        // the exact wallet debit the quote names, as the removed review showed it
        expect(screen.getByText(en.withdraw.confirm.youPay)).toBeInTheDocument()
        expect(screen.getByText('$92.50')).toBeInTheDocument()
        expect(screen.getByText(PROVIDERS['avenia-br'].brand)).toBeInTheDocument()
        expect(screen.getByText('help avenia-br')).toBeInTheDocument()
        // a withdrawal saves nothing against a card, has no Arrives row, and typed reais need no payout row
        expect(screen.queryByText(en.qrPay.info.saveVsCard)).toBeNull()
        expect(screen.queryByText(en.withdraw.bank.arrives)).toBeNull()
        expect(screen.queryByText(en.withdraw.bank.bankReceives)).toBeNull()
        expect(screen.getByRole('button', { name: en.common.confirm })).toBeEnabled()
    })

    // TASK-24947: the phone key reads as people write it (Aleks, 2026-11-14)
    it('shows a phone key, punctuated, with the masked CPF the directory names under the holder', () => {
        renderForm({
            recipient: {
                pixKey: '+5511912345678',
                holderName: 'Ana Souza',
                bankName: null,
                taxIdMasked: '111.***.***-35',
                ownAccount: true,
            },
        })
        expect(screen.getByText(/^11 91234-5678 ·$/)).toBeInTheDocument()
        expect(screen.getByText('CPF 111.***.***-35')).toBeInTheDocument()
    })

    // TASK-24947: another person's key is a send to them
    it("leads with Sending for another person's key, and with Withdrawing where the provider cannot tell", () => {
        const other = {
            pixKey: '+5511987654321',
            holderName: 'Bruno Lima',
            bankName: 'Nubank',
            taxIdMasked: '***.456.789-**',
        }
        const view = renderForm({ recipient: { ...other, ownAccount: false } })
        expect(screen.getByText(en.payment.confirm.sending)).toBeInTheDocument()
        expect(screen.queryByText(en.pix.withdraw.withdrawing)).toBeNull()
        expect(screen.getByText('Bruno Lima')).toBeInTheDocument()
        view.unmount()

        renderForm({ recipient: { ...other, ownAccount: null } })
        expect(screen.getByText(en.pix.withdraw.withdrawing)).toBeInTheDocument()
    })

    // a provider whose fees all sit in the rate sends a zero flat fee: no fee line, the same rate rule
    it('shows no fee row for a provider with no flat fee', () => {
        renderForm({
            display: { ...display, fixedFeeBrl: '0', bankName: null, provider: 'Manteca' },
            providerId: 'manteca-br',
        })
        expect(screen.queryByText(en.pix.withdraw.fee)).toBeNull()
        expect(screen.getByText('1 USD = 5.44 BRL')).toBeInTheDocument()
        expect(screen.getByText(PROVIDERS['manteca-br'].brand)).toBeInTheDocument()
    })

    // the user typed USD or tapped the balance: the reais are the quote's, so they get their own row
    it('shows the exact reais the quote pays out where the amount was not typed in reais', () => {
        renderForm({
            amount: { ...amount, seed: { amount: '92.50', denomination: 'USD' } },
            payout: 'R$503',
        })
        expect(screen.getByText(en.withdraw.bank.bankReceives)).toBeInTheDocument()
        expect(screen.getByText('R$503')).toBeInTheDocument()
        expect(screen.getByText('$92.50')).toBeInTheDocument()
    })

    // a refused quote has no numbers: the field converts with the indicative quote, the message and its action stand under the amount
    it('shows a refused quote as its message and action, with Confirm off and no fee or total row', () => {
        renderForm({
            display: null,
            total: undefined,
            canConfirm: false,
            error: {
                message: en.pix.withdraw.errors.limitExceeded,
                action: { label: en.common.retry, onClick: noop },
            },
        })
        expect(screen.getByText(en.pix.withdraw.errors.limitExceeded)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: en.common.retry })).toBeInTheDocument()
        expect(screen.getByText('1 USD = 5.37 BRL')).toBeInTheDocument()
        expect(screen.queryByText(en.pix.withdraw.fee)).toBeNull()
        expect(screen.queryByText(en.withdraw.confirm.youPay)).toBeNull()
        expect(screen.getByRole('button', { name: en.common.confirm })).toBeDisabled()
    })

    // Aleks, 2026-11-15 (staging): before an amount the row read "1 USD = 4.94 BRL", R$5 over the USDC that pays
    // the minimum with every fee in. It is the minimum quote's own rate, to two decimals, and no fee row yet.
    it.each([
        [5.299417064122946, '1 USD = 5.30 BRL'],
        [5.728962, '1 USD = 5.73 BRL'],
        [5.4, '1 USD = 5.40 BRL'],
    ])(
        'before the review, prints the indicative quote’s exchangeRate %s as %s, and no fee row',
        (exchangeRate, shown) => {
            renderForm({
                display: null,
                total: undefined,
                canConfirm: false,
                // the field still converts with amount ÷ USDC (4.94), never shown
                amount: { ...amount, price: 4.941639, rateAndFee: { exchangeRate, providerFeeBrl: '0.98' } },
            })
            expect(screen.getByText(shown)).toBeInTheDocument()
            expect(screen.queryByText('1 USD = 4.94 BRL')).toBeNull()
            expect(screen.queryByText(en.pix.withdraw.fee)).toBeNull()
        }
    )

    it('keeps the rate row, empty, while the indicative quote loads', () => {
        renderForm({
            display: null,
            total: undefined,
            canConfirm: false,
            amount: { ...amount, rateAndFee: undefined },
        })
        expect(screen.getByText(en.qrPay.info.exchangeRate)).toBeInTheDocument()
        expect(screen.queryByText(/^1 USD =/)).toBeNull()
    })

    // the API sends the pair only where it is proven: an Avenia screen then shows neither row, never a derived rate
    it('shows neither the rate nor the fee row where Avenia’s answer carries no pair', () => {
        const { exchangeRate: _rate, providerFeeBrl: _fee, ...withoutPair } = display
        const view = renderForm({ display: withoutPair })
        expect(screen.queryByText(en.qrPay.info.exchangeRate)).toBeNull()
        expect(screen.queryByText(/^1 USD =/)).toBeNull()
        expect(screen.queryByText(en.pix.withdraw.fee)).toBeNull()
        expect(screen.queryByText('R$0.75')).toBeNull()
        view.unmount()

        renderForm({ display: null, total: undefined, canConfirm: false, amount: { ...amount, rateAndFee: null } })
        expect(screen.queryByText(en.qrPay.info.exchangeRate)).toBeNull()
        expect(screen.queryByText(/^1 USD =/)).toBeNull()
    })

    // the quote of the amount on screen is in flight: the Total row waits for it rather than showing an estimate
    it('waits for the quote on the Total row while it is in flight', () => {
        const { container } = renderForm({ display: null, total: null, canConfirm: false })
        expect(screen.getByText(en.withdraw.confirm.youPay)).toBeInTheDocument()
        expect(screen.queryByText('$92.50')).toBeNull()
        expect(container.querySelector('.animate-spin')).not.toBeNull()
    })

    // Aleks, 16 Nov 2026: one message, as the box directly under the amount, and no error line of the field's own;
    // above the details card and Confirm, so it is read before Confirm (Chip, ui#4082)
    it.each([
        ['the minimum', { message: en.pix.deposit.minimum.replace('{amount}', 'R$5') }],
        ['the moved quote', { message: en.pix.withdraw.quoteMoved, priority: 'attention' as const }],
    ])('shows %s once, under the amount box and above the details card and Confirm', (_, error) => {
        renderForm({ save: { ...save, isOffered: true, checked: true, nickname: 'Ana Souza' }, error })
        expect(screen.getAllByText(error.message)).toHaveLength(1)
        const notice = screen.getByRole('alert')
        expect(notice).toHaveTextContent(error.message)
        const follows = (node: Element) => !!(notice.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING)
        for (const above of [
            screen.getByText('Ana Souza'),
            screen.getByText(en.global.savedAddresses.savePrompt),
            screen.getByPlaceholderText('0.00'),
        ])
            expect(follows(above)).toBe(false)
        for (const below of [
            screen.getByText(en.qrPay.info.exchangeRate),
            screen.getByText(en.withdraw.confirm.youPay),
            screen.getByRole('button', { name: en.common.confirm }),
        ])
            expect(follows(below)).toBe(true)
    })

    it('offers to save the key under its holder, as the payment form does', () => {
        renderForm({ save: { ...save, isOffered: true, checked: true, nickname: 'Ana Souza' } })
        expect(screen.getByText(en.global.savedAddresses.savePrompt)).toBeInTheDocument()
        expect(screen.getByDisplayValue('Ana Souza')).toBeInTheDocument()
    })

    it('names the key the user already saved', () => {
        renderForm({ save: { ...save, savedName: 'Inter' } })
        expect(screen.getByTestId('pix-key-saved-as')).toHaveTextContent('Saved as Inter')
        expect(screen.queryByText(en.global.savedAddresses.savePrompt)).toBeNull()
    })
})
