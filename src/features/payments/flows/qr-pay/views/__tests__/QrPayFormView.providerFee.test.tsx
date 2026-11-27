/** @jest-environment jsdom */
import { fireEvent, screen } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import en from '@/i18n/app/messages/en.json'
import { PROVIDERS } from '@/constants/providers.consts'

// general.utils reaches the viem clients, whose RPC-ranking timers keep the worker alive
jest.mock('@/app/actions/clients', () => ({}))
jest.mock('@/app/actions/increase-limits', () => ({ initiateIncreaseLimits: jest.fn() }))
jest.mock('@/components/Global/NavHeader', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Kyc/SumsubKycWrapper', () => ({ SumsubKycWrapper: () => null }))
jest.mock('@/features/paperwork-verification/analytics', () => ({
    KycControlFlowProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))
jest.mock('@/hooks/useSumsubActionFlow', () => ({
    useSumsubActionFlow: () => ({ showWrapper: false, isLoading: false, handleInitiate: jest.fn() }),
}))
jest.mock('@/hooks/useLimits', () => ({ useLimits: () => ({ mantecaLimits: null, refetch: jest.fn() }) }))
jest.mock('@/features/limits/hooks/useLimitsValidation', () => ({
    useLimitsValidation: () => ({ isBlocking: false, currency: 'BRL' }),
}))
jest.mock('@/features/limits/utils', () => ({
    getLimitsWarningCardProps: () => null,
    isBrUserEligibleForLimitIncrease: () => false,
}))
jest.mock('@/hooks/useCardMarkupRate', () => ({
    useCardMarkupRate: () => ({ data: { rate: 0.05, source: 'static' } }),
}))
jest.mock('@/context/ModalsContext', () => ({ useModalsContext: () => ({ openSupportWithMessage: jest.fn() }) }))
jest.mock('@/components/Provider/ProviderHelp', () => ({
    ProviderHelp: ({ providerId }: { providerId: string }) => <span>help {providerId}</span>,
}))
const mockPush = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }))
let mockProviderFee: string | null = null
let mockShownRate: number | null = null
let mockHideRate = false
let mockBalanceErrorMessage: string | null = null
let mockIsShortOfBalance = false
let mockIsLoading = false
jest.mock('../../QrPayFlowContext', () => ({
    useQrPayFlow: () => ({
        qrPayment: null,
        merchantName: 'Ana Souza',
        merchantTaxId: null,
        recipientBankName: 'Banco Inter',
        providerFee: mockProviderFee,
        shownRate: mockShownRate,
        hideRate: mockHideRate,
        providerId: 'manteca-br',
        amountFixed: true,
        pixKeyLabel: '11144477735',
        pixKeyOwner: { name: 'Ana Souza', legalIdMasked: null },
        isAwaitingPixKeyOwner: false,
        pixKeySave: {
            isOffered: true,
            savedName: null,
            checked: true,
            nickname: 'Ana Souza',
            setChecked: jest.fn(),
            setNickname: jest.fn(),
            blocksPay: false,
            saveAfterPayment: jest.fn(),
        },
        methodIcon: '/pix.svg',
        currency: { code: 'BRL', symbol: 'R$', price: 5.4 },
        currencyAmount: '100',
        amount: '18.52',
        setAmount: jest.fn(),
        usdAmount: '18.52',
        errorMessage: null,
        errorInitiatingPayment: null,
        isBlockingError: false,
        balanceErrorMessage: mockBalanceErrorMessage,
        isShortOfBalance: mockIsShortOfBalance,
        rateUnavailable: false,
        retryRate: jest.fn(),
        shouldBlockPay: false,
        isLoading: mockIsLoading,
        loadingState: mockIsLoading ? 'Approve transaction' : 'Idle',
        quoteUpdatedNotice: null,
        isQuoteRecovering: false,
        amountInputRevision: 0,
        payQR: jest.fn(),
        handleCurrencyAmountChange: jest.fn(),
        balance: 100_000_000n,
    }),
}))

import { QrPayFormView } from '../QrPayFormView'

describe('QrPayFormView', () => {
    beforeEach(() => {
        mockProviderFee = null
        mockShownRate = null
        mockHideRate = false
        mockBalanceErrorMessage = null
        mockIsShortOfBalance = false
        mockIsLoading = false
        mockPush.mockClear()
    })

    // the shared form (ruling 2026-11-12): the look the Pix withdrawal copies
    it('leads with Paying, the holder, their CPF and bank; offers to save the key; shows the rate, the sponsored Peanut fee and the provider, and no saving against a card for BRL', () => {
        renderWithIntl(<QrPayFormView />)
        expect(screen.getByText(en.qrPay.youArePaying)).toBeInTheDocument()
        expect(screen.getByText('Ana Souza')).toBeInTheDocument()
        expect(screen.getByText('CPF 111.444.777-35')).toBeInTheDocument()
        expect(screen.getByText('Banco Inter')).toBeInTheDocument()
        expect(screen.getByText(en.global.savedAddresses.savePrompt)).toBeInTheDocument()
        expect(screen.getByText('1 USD = 5.40 BRL')).toBeInTheDocument()
        // BRL has no card comparison, even when a backend still publishes a rate (pricing.md B-4)
        expect(screen.queryByText(en.qrPay.info.saveVsCard)).toBeNull()
        expect(screen.queryByText('~$0.93')).toBeNull()
        expect(screen.getByText(en.common.sponsoredByPeanut)).toBeInTheDocument()
        expect(screen.getByText(PROVIDERS['manteca-br'].brand)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: en.navigation.pay })).toBeEnabled()
    })

    it('shows no provider fee row: the Manteca lock carries no flat fee', () => {
        renderWithIntl(<QrPayFormView />)
        expect(screen.queryByText(en.pix.withdraw.fee)).toBeNull()
    })

    it('shows the provider fee row when the quote carries one', () => {
        mockProviderFee = 'R$0.75'
        renderWithIntl(<QrPayFormView />)
        expect(screen.getByText(en.pix.withdraw.fee)).toBeInTheDocument()
        expect(screen.getByText('R$0.75')).toBeInTheDocument()
    })

    // Avenia: the rate the flow names (variable fees inside, TASK-24967), never the field's price
    it('prints the rate the flow names over the field’s price', () => {
        mockShownRate = 5.796567
        mockProviderFee = 'R$0.75'
        renderWithIntl(<QrPayFormView />)
        expect(screen.getByText('1 USD = 5.80 BRL')).toBeInTheDocument()
        expect(screen.queryByText('1 USD = 5.40 BRL')).toBeNull()
        expect(screen.getByText('R$0.75')).toBeInTheDocument()
    })

    it('shows no rate row where the flow hides it, and never falls back to the field’s price', () => {
        mockHideRate = true
        renderWithIntl(<QrPayFormView />)
        expect(screen.queryByText(en.qrPay.info.exchangeRate)).toBeNull()
        expect(screen.queryByText(/^1 USD =/)).toBeNull()
    })

    // TASK-25444: a balance that cannot cover the amount was a dead end with a disabled Pay
    it('offers Add money in place of Pay when the balance is short, and keeps the scanned QR as the way back', () => {
        mockBalanceErrorMessage = en.errors.notEnoughBalanceAddFunds
        mockIsShortOfBalance = true
        window.history.replaceState(null, '', '/qr-pay?qrCode=00020101&type=PIX&t=1')
        renderWithIntl(<QrPayFormView />)
        expect(screen.getByText(en.errors.notEnoughBalanceAddFunds)).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: en.navigation.pay })).toBeNull()
        fireEvent.click(screen.getByRole('button', { name: en.qrPay.addMoney }))
        expect(mockPush).toHaveBeenCalledWith(
            `/add-money?returnTo=${encodeURIComponent('/qr-pay?qrCode=00020101&type=PIX&t=1')}`
        )
    })

    it('keeps the in-flight Pay button while a payment is loading, even if the balance reads short', () => {
        mockBalanceErrorMessage = en.errors.notEnoughBalanceAddFunds
        mockIsShortOfBalance = true
        mockIsLoading = true
        renderWithIntl(<QrPayFormView />)
        expect(screen.queryByRole('button', { name: en.qrPay.addMoney })).toBeNull()
        expect(screen.getByTestId('qr-pay-confirm')).toBeInTheDocument()
    })
})
