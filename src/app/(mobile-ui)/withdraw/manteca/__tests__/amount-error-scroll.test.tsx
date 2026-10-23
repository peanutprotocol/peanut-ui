import React from 'react'
import { NuqsTestingAdapter } from 'nuqs/adapters/testing'
import { act, fireEvent, screen } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { parseUnits } from 'viem'
import MantecaWithdrawFlow from '../page'

const mockPush = jest.fn()
let mockParams = 'country=argentina&method=bank-transfer&isSavedAccount=true&destination=qa.account'
let mockBalance: bigint | undefined = parseUnits('10', 6)
jest.mock('next/navigation', () => ({
    useSearchParams: () => new URLSearchParams(mockParams),
    useRouter: () => ({ push: mockPush, replace: mockPush, back: jest.fn() }),
    usePathname: () => '/withdraw/manteca',
}))
jest.mock('@/config/underMaintenance.config', () => ({ __esModule: true, default: { disabledMantecaCurrencies: [] } }))
jest.mock('@/hooks/wallet/useWallet', () => ({
    useWallet: () => ({ spendableBalance: mockBalance, formattedSpendableBalance: '10.00' }),
}))
jest.mock('@/hooks/wallet/useSignSpendBundle', () => ({ useSignSpendBundle: () => ({ signSpend: jest.fn() }) }))
jest.mock('@/hooks/wallet/useStaleSessionGuard', () => ({ useStaleSessionGuard: () => jest.fn() }))
jest.mock('@/hooks/useFriendlyError', () => ({ useFriendlyError: () => jest.fn() }))
jest.mock('@/hooks/useSafeBack', () => ({ useSafeBack: () => jest.fn(), useReturnTo: () => jest.fn() }))
jest.mock('@/hooks/useRainCardOverview', () => ({ useRainCardOverview: () => ({ overview: null }) }))
jest.mock('@/hooks/useCurrency', () => ({
    useCurrency: () => ({ code: 'ARS', price: { sell: 1200, buy: 1200 }, isLoading: false }),
}))
jest.mock('@/context/ModalsContext', () => ({
    useModalsContext: () => ({ setIsSupportModalOpen: jest.fn(), openSupportWithMessage: jest.fn() }),
}))
jest.mock('@/hooks/useCapabilities', () => ({ useCapabilities: () => ({ rails: [], nextActions: [] }) }))
jest.mock('@/hooks/useIdentityVerification', () => ({ useIdentityVerification: () => ({ isVerified: true }) }))
jest.mock('@/hooks/wallet/usePendingTransactions', () => ({
    usePendingTransactions: () => ({ hasPendingTransactions: false }),
}))
jest.mock('@/hooks/useMultiPhaseKycFlow', () => ({ useMultiPhaseKycFlow: () => ({}) }))
jest.mock('@/hooks/useSumsubActionFlow', () => ({ useSumsubActionFlow: () => ({}) }))
jest.mock('@/hooks/useLimits', () => ({ useLimits: () => ({}) }))
jest.mock('@/features/limits/hooks/useLimitsValidation', () => ({ useLimitsValidation: () => ({ isBlocking: false }) }))
jest.mock('@/features/limits/utils', () => ({
    getLimitsWarningCardProps: () => null,
    isBrUserEligibleForLimitIncrease: () => false,
}))
jest.mock('@/utils/regions.utils', () => ({ isVerifiedForCountry: () => true }))
jest.mock('@/hooks/usePointsCalculation', () => ({ usePointsCalculation: () => ({}) }))
jest.mock('@/hooks/usePointsConfetti', () => ({ usePointsConfetti: () => {} }))
jest.mock('@/components/Kyc/SumsubKycModals', () => ({ SumsubKycModals: () => null }))
jest.mock('@/components/Kyc/InitiateKycModal', () => ({ InitiateKycModal: () => null }))
jest.mock('@/components/Kyc/SumsubKycWrapper', () => ({ SumsubKycWrapper: () => null }))
jest.mock('@/components/Global/NavHeader', () => ({
    __esModule: true,
    default: ({ onPrev, title }: { onPrev: () => void; title: string }) => (
        <>
            <h1>{title}</h1>
            <button onClick={onPrev}>Back</button>
        </>
    ),
}))
jest.mock('@/features/withdraw/views/PixKeySendView', () => ({ __esModule: true, default: () => null }))
jest.mock('@/services/manteca', () => ({ mantecaApi: {} }))

const ARS_PARAMS = 'country=argentina&method=bank-transfer&isSavedAccount=true&destination=qa.account'
const MINIMUM_ERROR = /withdraw amount must be at least/i
const scrollIntoView = jest.fn()
const originalScrollIntoView = Element.prototype.scrollIntoView

beforeEach(() => {
    mockBalance = parseUnits('10', 6)
    mockParams = ARS_PARAMS
    scrollIntoView.mockReset()
    Element.prototype.scrollIntoView = scrollIntoView
})

afterEach(() => {
    Element.prototype.scrollIntoView = originalScrollIntoView
})

// a deferred scroll (animation frame / short timer) must still land inside the assertion window
async function settle(): Promise<void> {
    await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 80))
    })
}

function setup() {
    renderWithIntl(
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
            <NuqsTestingAdapter searchParams={mockParams}>
                <MantecaWithdrawFlow />
            </NuqsTestingAdapter>
        </QueryClientProvider>
    )
    return screen.getByRole('textbox') as HTMLInputElement
}

describe('ARS/BRL withdrawal minimum-amount error (TASK-21966)', () => {
    it('keeps the error directly under the amount input, above Continue', () => {
        const field = setup()
        fireEvent.change(field, { target: { value: '0.05' } })
        const message = screen.getByText(MINIMUM_ERROR)
        const continueButton = screen.getByRole('button', { name: 'Continue' })
        expect(field.compareDocumentPosition(message) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
        expect(message.compareDocumentPosition(continueButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    })

    it('scrolls the error into view, nearest block, when it appears while the input is focused', async () => {
        const field = setup()
        act(() => field.focus())
        expect(document.activeElement).toBe(field)
        expect(scrollIntoView).not.toHaveBeenCalled()

        fireEvent.change(field, { target: { value: '0.05' } })
        await settle()

        expect(scrollIntoView).toHaveBeenCalledTimes(1)
        expect(scrollIntoView).toHaveBeenCalledWith(expect.objectContaining({ block: 'nearest' }))
        const target = scrollIntoView.mock.contexts[0] as Element
        const message = screen.getByText(MINIMUM_ERROR)
        expect(target === message || (target.contains(message) && !target.contains(field))).toBe(true)
    })

    it('does not scroll when the error appears while the input is not focused', async () => {
        const field = setup()
        act(() => field.blur())
        expect(document.activeElement).not.toBe(field)

        fireEvent.change(field, { target: { value: '0.05' } })
        await settle()

        expect(screen.getByText(MINIMUM_ERROR)).toBeInTheDocument()
        expect(scrollIntoView).not.toHaveBeenCalled()
    })

    it('scrolls once per appearance, not while the same error stays up', async () => {
        const field = setup()
        act(() => field.focus())

        fireEvent.change(field, { target: { value: '0.05' } })
        await settle()
        fireEvent.change(field, { target: { value: '0.04' } })
        await settle()
        expect(scrollIntoView).toHaveBeenCalledTimes(1)

        fireEvent.change(field, { target: { value: '6000' } })
        await settle()
        expect(screen.queryByText(MINIMUM_ERROR)).not.toBeInTheDocument()
        expect(scrollIntoView).toHaveBeenCalledTimes(1)

        fireEvent.change(field, { target: { value: '0.05' } })
        await settle()
        expect(scrollIntoView).toHaveBeenCalledTimes(2)
    })

    it('does not scroll for a valid amount', async () => {
        const field = setup()
        act(() => field.focus())
        fireEvent.change(field, { target: { value: '6000' } })
        await settle()
        expect(scrollIntoView).not.toHaveBeenCalled()
    })
})
