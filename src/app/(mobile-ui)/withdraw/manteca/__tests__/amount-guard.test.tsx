import React from 'react'
import { NuqsTestingAdapter } from 'nuqs/adapters/testing'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { parseUnits } from 'viem'
import MantecaWithdrawFlow from '../page'

const mockPush = jest.fn()
let mockBalance: bigint | undefined = parseUnits('10', 6)
jest.mock('next/navigation', () => ({
    useSearchParams: () => new URLSearchParams('country=argentina&method=bank-transfer'),
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
jest.mock('@/hooks/useSafeBack', () => ({ useSafeBack: () => jest.fn() }))
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
jest.mock('@/components/Global/NavHeader', () => ({ __esModule: true, default: () => null }))
jest.mock('@/features/withdraw/views/PixKeySendView', () => ({ __esModule: true, default: () => null }))
jest.mock('@/services/manteca', () => ({ mantecaApi: {} }))

beforeEach(() => {
    mockBalance = parseUnits('10', 6)
})
function setup() {
    renderWithIntl(
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
            <NuqsTestingAdapter searchParams="country=argentina&method=bank-transfer">
                <MantecaWithdrawFlow />
            </NuqsTestingAdapter>
        </QueryClientProvider>
    )
    return screen.getByRole('textbox')
}

test('keeps a positive local amount below the USD precision blocked, including a currency round trip', () => {
    const field = setup()
    fireEvent.change(field, { target: { value: '0.05' } })
    expect(screen.getByText(/withdraw amount must be at least/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: /switch currency/i }))
    expect(field).toHaveValue('0')
    expect(screen.getByText(/withdraw amount must be at least/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: /switch currency/i }))
    expect(field).toHaveValue('0.05')
    expect(screen.getByText(/withdraw amount must be at least/i)).toBeInTheDocument()
})

test('blocks an amount above the balance and allows an amount within it', () => {
    const field = setup()
    fireEvent.change(field, { target: { value: '24000' } })
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled()
    expect(screen.getByText(/not enough balance/i)).toBeInTheDocument()
    fireEvent.change(field, { target: { value: '6000' } })
    expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled()
})
