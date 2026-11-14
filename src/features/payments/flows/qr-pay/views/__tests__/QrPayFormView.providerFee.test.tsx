/** @jest-environment jsdom */
import { screen } from '@testing-library/react'
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
let mockProviderFee: string | null = null
jest.mock('../../QrPayFlowContext', () => ({
    useQrPayFlow: () => ({
        paymentProcessor: 'MANTECA',
        targetMantecaCountry: 'BR',
        paymentLock: { code: 'lock-1' },
        qrPayment: null,
        merchantName: 'Ana Souza',
        recipientBankName: 'Banco Inter',
        providerFee: mockProviderFee,
        pixKeyLabel: '09579927189',
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
        balanceErrorMessage: null,
        rateUnavailable: false,
        retryRate: jest.fn(),
        shouldBlockPay: false,
        isLoading: false,
        loadingState: 'idle',
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
    })

    // the shared form (ruling 2026-11-12): the look the Pix withdrawal copies
    it('leads with Paying, the holder, their CPF and bank; offers to save the key; shows the rate, the savings against a card, the sponsored Peanut fee and the provider', () => {
        renderWithIntl(<QrPayFormView />)
        expect(screen.getByText(en.qrPay.youArePaying)).toBeInTheDocument()
        expect(screen.getByText('Ana Souza')).toBeInTheDocument()
        expect(screen.getByText('CPF 095.799.271-89')).toBeInTheDocument()
        expect(screen.getByText('Banco Inter')).toBeInTheDocument()
        expect(screen.getByText(en.global.savedAddresses.savePrompt)).toBeInTheDocument()
        expect(screen.getByText('1 USD = 5.4 BRL')).toBeInTheDocument()
        // $18.52 × 5% against a foreign card
        expect(screen.getByText(en.qrPay.info.saveVsCard)).toBeInTheDocument()
        expect(screen.getByText('~$0.93')).toBeInTheDocument()
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
})
