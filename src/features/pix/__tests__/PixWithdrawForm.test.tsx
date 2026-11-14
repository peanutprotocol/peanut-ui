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
    pixKey: '09579927189',
    ownAccount: null,
    holderName: 'Ana Souza',
    bankName: 'Banco Inter',
    withdrawUsd: '92.504310',
    rate: '5.445692',
    fixedFeeBrl: '0.75',
    arrivalEstimateSeconds: 60,
    provider: 'Manteca' as const,
}
const noop = () => {}
const save = { savedName: null, isOffered: false, checked: false, nickname: '', setChecked: noop, setNickname: noop }
const amount = {
    seed: { amount: '503', denomination: 'BRL' as const },
    price: 5.4,
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
            recipient={{ pixKey: display.pixKey, holderName: 'Ana Souza', bankName: 'Banco Inter', taxIdMasked: null }}
            save={save}
            amount={amount}
            display={display}
            total="$92.50"
            providerId="manteca-br"
            error={null}
            isSubmitting={false}
            canConfirm
            onConfirm={noop}
            {...props}
        />
    )

describe('PixWithdrawForm', () => {
    // the Pix-key payment form, with the withdrawal's lead word and button (ruling 2026-11-12)
    it('leads with Withdrawing, the holder, their CPF and bank; then the rate with the fees in, the sponsored Peanut fee, the flat fee apart, the exact total and the provider', () => {
        renderForm()
        expect(screen.getByText(en.pix.withdraw.withdrawing)).toBeInTheDocument()
        expect(screen.getByText('Ana Souza')).toBeInTheDocument()
        // a CPF key is the holder's own tax ID: shown once, punctuated
        expect(screen.getByText('CPF 095.799.271-89')).toBeInTheDocument()
        expect(screen.getByText('Banco Inter')).toBeInTheDocument()
        // $92.50 × 5.445946 − R$0.75 = R$503.00: the three numbers agree to the centavo
        expect(screen.getByText('1 USD = 5.445946 BRL')).toBeInTheDocument()
        expect(screen.getByText(en.common.peanutFee)).toBeInTheDocument()
        expect(screen.getByText(en.common.sponsoredByPeanut)).toBeInTheDocument()
        expect(screen.getByText(en.pix.withdraw.fee)).toBeInTheDocument()
        expect(screen.getByText('R$0.75')).toBeInTheDocument()
        // the exact wallet debit the quote names, as the removed review showed it
        expect(screen.getByText(en.withdraw.confirm.youPay)).toBeInTheDocument()
        expect(screen.getByText('$92.50')).toBeInTheDocument()
        expect(screen.getByText(PROVIDERS['manteca-br'].brand)).toBeInTheDocument()
        expect(screen.getByText('help manteca-br')).toBeInTheDocument()
        // a withdrawal saves nothing against a card, has no Arrives row, and typed reais need no payout row
        expect(screen.queryByText(en.qrPay.info.saveVsCard)).toBeNull()
        expect(screen.queryByText(en.withdraw.bank.arrives)).toBeNull()
        expect(screen.queryByText(en.withdraw.bank.bankReceives)).toBeNull()
        expect(screen.getByRole('button', { name: en.common.confirm })).toBeEnabled()
    })

    it('shows a phone key with the masked CPF the directory names under the holder', () => {
        renderForm({
            recipient: {
                pixKey: '+5511912345678',
                holderName: 'Ana Souza',
                bankName: null,
                taxIdMasked: '095.***.***-89',
            },
        })
        expect(screen.getByText(/^\+5511912345678 ·$/)).toBeInTheDocument()
        expect(screen.getByText('CPF 095.***.***-89')).toBeInTheDocument()
    })

    // a provider whose fees all sit in the rate sends a zero flat fee: no fee line, the same rate rule
    it('shows no fee row where the quote carries no flat fee', () => {
        renderForm({ display: { ...display, fixedFeeBrl: '0', bankName: null } })
        expect(screen.queryByText(en.pix.withdraw.fee)).toBeNull()
        expect(screen.getByText('1 USD = 5.437838 BRL')).toBeInTheDocument()
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

    // a refused quote has no numbers: the field converts with the indicative quote, the message and its action stand under Confirm
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
        expect(screen.getByText('1 USD = 5.4 BRL')).toBeInTheDocument()
        expect(screen.queryByText(en.pix.withdraw.fee)).toBeNull()
        expect(screen.queryByText(en.withdraw.confirm.youPay)).toBeNull()
        expect(screen.getByRole('button', { name: en.common.confirm })).toBeDisabled()
    })

    // the indicative quote's ratio is a float: the rate row prints it to the review's six decimals, not all its digits
    it('prints the indicative rate to six decimals before the review answers', () => {
        renderForm({
            display: null,
            total: undefined,
            canConfirm: false,
            amount: { ...amount, price: 5.299417064122946 },
        })
        expect(screen.getByText('1 USD = 5.299417 BRL')).toBeInTheDocument()
    })

    // the quote of the amount on screen is in flight: the Total row waits for it rather than showing an estimate
    it('waits for the quote on the Total row while it is in flight', () => {
        const { container } = renderForm({ display: null, total: null, canConfirm: false })
        expect(screen.getByText(en.withdraw.confirm.youPay)).toBeInTheDocument()
        expect(screen.queryByText('$92.50')).toBeNull()
        expect(container.querySelector('.animate-spin')).not.toBeNull()
    })

    // the notice must be read before Confirm: it sits under the recipient card, above the save card and the amount,
    // so a 393×852 viewport shows it whatever cards the form carries
    it('keeps the quote notice in the first viewport: under the recipient, above the save card and the amount', () => {
        renderForm({
            save: { ...save, isOffered: true, checked: true, nickname: 'Ana Souza' },
            error: { message: en.pix.withdraw.quoteMoved, priority: 'attention' },
        })
        const notice = screen.getByRole('alert')
        expect(notice).toHaveTextContent(en.pix.withdraw.quoteMoved)
        const follows = (node: Element) => !!(notice.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING)
        expect(follows(screen.getByText(en.global.savedAddresses.savePrompt))).toBe(true)
        expect(follows(screen.getByPlaceholderText('0.00'))).toBe(true)
        expect(follows(screen.getByRole('button', { name: en.common.confirm }))).toBe(true)
        // and the recipient card stays the lead
        expect(follows(screen.getByText('Ana Souza'))).toBe(false)
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

    // TASK-24910: Bridge pays another person's key; it locks no rate, so the reais are an estimate
    describe('a payout through Bridge', () => {
        const bridgeDisplay = {
            ...display,
            pixKey: '11144477735',
            ownAccount: false,
            holderName: 'BRUNO LIMA',
            bankName: 'Nu Pagamentos S.A.',
            amountBrl: '100.00',
            withdrawUsd: '18.87',
            fixedFeeBrl: '0',
            provider: 'Bridge',
            amountBrlEstimated: true as const,
        }
        const bridgeRecipient = {
            pixKey: '11144477735',
            holderName: 'BRUNO LIMA',
            bankName: 'Nu Pagamentos S.A.',
            taxIdMasked: null,
        }

        it("reads as a send to another person's key: Sending, the validated holder and bank, the reais marked ≈, Bridge", () => {
            renderForm({
                recipient: { ...bridgeRecipient, ownAccount: false },
                display: bridgeDisplay,
                payout: '≈ R$100',
                total: '$18.87',
                providerId: 'bridge-row',
            })
            expect(screen.getByText(en.payment.confirm.sending)).toBeInTheDocument()
            expect(screen.queryByText(en.pix.withdraw.withdrawing)).toBeNull()
            expect(screen.getByText('BRUNO LIMA')).toBeInTheDocument()
            expect(screen.getByText('CPF 111.444.777-35')).toBeInTheDocument()
            expect(screen.getByText('Nu Pagamentos S.A.')).toBeInTheDocument()
            expect(screen.getByText(en.withdraw.bank.bankReceives)).toBeInTheDocument()
            expect(screen.getByText('≈ R$100')).toBeInTheDocument()
            expect(screen.getByText('$18.87')).toBeInTheDocument()
            // no fee on the quote: no fee row
            expect(screen.queryByText(en.pix.withdraw.fee)).toBeNull()
            expect(screen.getByText(PROVIDERS['bridge-row'].brand)).toBeInTheDocument()
        })

        it("reads as a withdrawal to the user's own key, with the fee row a receipt fee brings", () => {
            renderForm({
                recipient: { ...bridgeRecipient, holderName: 'ANA SOUZA', ownAccount: true },
                display: { ...bridgeDisplay, ownAccount: true, amountBrl: '97.88', fixedFeeBrl: '2.12' },
                providerId: 'bridge-row',
            })
            expect(screen.getByText(en.pix.withdraw.withdrawing)).toBeInTheDocument()
            expect(screen.getByText(en.pix.withdraw.fee)).toBeInTheDocument()
            expect(screen.getByText('R$2.12')).toBeInTheDocument()
        })

        // API-CONTRACT 8.1, the work order's example: $20.00 at 5.72 is R$114.40, less R$0.63 is R$113.77
        const marketDisplay = {
            ...bridgeDisplay,
            withdrawUsd: '20.00',
            rate: '5.6885',
            marketRate: '5.72',
            amountBrl: '113.77',
            providerFeeBrl: '0.63',
        }
        const labelsInOrder = () =>
            [en.qrPay.info.exchangeRate, en.pix.withdraw.fee, en.common.peanutFee, en.withdraw.bank.bankReceives].map(
                (label) => screen.getByText(label)
            )
        const inOrder = (nodes: HTMLElement[]) =>
            nodes.every(
                (node, i) =>
                    i === 0 || !!(nodes[i - 1].compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING)
            )

        it('with the mid-market rate: the market rate, then the provider fee marked ≈, then the Peanut fee, and they add up', () => {
            renderForm({
                recipient: { ...bridgeRecipient, ownAccount: false },
                display: marketDisplay,
                payout: '≈ R$113.77',
                total: '$20',
                providerId: 'bridge-row',
            })
            expect(screen.getByText('1 USD = 5.72 BRL')).toBeInTheDocument()
            expect(screen.getByText('≈ R$0.63')).toBeInTheDocument()
            expect(screen.getByText('≈ R$113.77')).toBeInTheDocument()
            expect(screen.getByText(en.common.sponsoredByPeanut)).toBeInTheDocument()
            expect(inOrder(labelsInOrder())).toBe(true)
        })

        it('shows one fee row, the provider fee, where Bridge also states a flat fee', () => {
            renderForm({
                display: { ...marketDisplay, fixedFeeBrl: '0.20', amountBrl: '113.57', providerFeeBrl: '0.83' },
                providerId: 'bridge-row',
            })
            expect(screen.getAllByText(en.pix.withdraw.fee)).toHaveLength(1)
            expect(screen.getByText('≈ R$0.83')).toBeInTheDocument()
            expect(screen.queryByText('R$0.20')).toBeNull()
            expect(screen.getByText('1 USD = 5.72 BRL')).toBeInTheDocument()
        })
    })

    // Manteca's route, or a Bridge quote without a mid-market rate: the rows stay as they are today
    it('without the mid-market rate keeps the all-in rate, the Peanut fee, then the flat fee', () => {
        renderForm()
        const [rate, peanut, fee] = [en.qrPay.info.exchangeRate, en.common.peanutFee, en.pix.withdraw.fee].map(
            (label) => screen.getByText(label)
        )
        expect(rate.compareDocumentPosition(peanut) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
        expect(peanut.compareDocumentPosition(fee) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
        expect(screen.getByText('R$0.75')).toBeInTheDocument()
        expect(screen.queryByText('≈ R$0.75')).toBeNull()
    })
})
