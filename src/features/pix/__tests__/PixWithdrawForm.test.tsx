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
    ownAccount: true as const,
    holderName: 'Ana Souza',
    bankName: 'Banco Inter',
    withdrawUsd: '92.504310',
    rate: '5.445692',
    fixedFeeBrl: '0.75',
    arrivalEstimateSeconds: 60,
    provider: 'Avenia' as const,
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
            isQuoteLoading={false}
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
    it('leads with Withdrawing, the holder, their CPF and bank; then the rate with the fees in, the sponsored Peanut fee, the flat fee apart and the provider', () => {
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
        expect(screen.getByText(PROVIDERS['avenia-br'].brand)).toBeInTheDocument()
        expect(screen.getByText('help avenia-br')).toBeInTheDocument()
        // a withdrawal saves nothing against a card, and the form has no Arrives row
        expect(screen.queryByText(en.qrPay.info.saveVsCard)).toBeNull()
        expect(screen.queryByText(en.withdraw.bank.arrives)).toBeNull()
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
    it('shows no fee row for a provider with no flat fee', () => {
        renderForm({
            display: { ...display, fixedFeeBrl: '0', bankName: null, provider: 'Manteca' },
            providerId: 'manteca-br',
        })
        expect(screen.queryByText(en.pix.withdraw.fee)).toBeNull()
        expect(screen.getByText('1 USD = 5.437838 BRL')).toBeInTheDocument()
        expect(screen.getByText(PROVIDERS['manteca-br'].brand)).toBeInTheDocument()
    })

    // a refused quote has no numbers: the field converts with the indicative quote, the message and its action stand under Confirm
    it('shows a refused quote as its message and action, with Confirm off and no fee row', () => {
        renderForm({
            display: null,
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
        expect(screen.getByRole('button', { name: en.common.confirm })).toBeDisabled()
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
