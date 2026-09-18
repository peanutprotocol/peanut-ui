import React from 'react'
import { NuqsTestingAdapter } from 'nuqs/adapters/testing'
import { fireEvent, screen, waitFor, act } from '@testing-library/react'
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

beforeEach(() => {
    mockBalance = parseUnits('10', 6)
    mockParams = 'country=argentina&method=bank-transfer&isSavedAccount=true&destination=qa.account'
})
function setup() {
    renderWithIntl(
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
            <NuqsTestingAdapter searchParams={mockParams}>
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

// TASK-22589: the amount is the last step now, so this flow is entered without
// one and collects it here in the local currency.
test('a saved destination opens the amount step', () => {
    setup()
    expect(screen.getByText(/amount to cash out/i)).toBeInTheDocument()
})

test('a new destination opens bank details before amount', () => {
    mockParams = 'country=argentina&method=bank-transfer'
    setup()
    expect(screen.queryByText(/amount to cash out/i)).not.toBeInTheDocument()
    expect(screen.getByRole('textbox')).toHaveAttribute('placeholder', expect.stringMatching(/CBU|CVU|alias/i))
})

test('destination → amount → back → amount does not loop or lose the destination', async () => {
    mockParams = 'country=argentina&method=bank-transfer'
    const field = setup()
    fireEvent.change(field, { target: { value: 'qa.account' } })
    await waitFor(() => expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled())
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Continue' })))
    expect(screen.getByText(/amount to cash out/i)).toBeInTheDocument()
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Back' })))
    expect(screen.getByRole('textbox')).toHaveValue('qa.account')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled())
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Continue' })))
    expect(screen.getByText(/amount to cash out/i)).toBeInTheDocument()
})

it('shows Send and returns to Send after a bank-origin handoff', async () => {
    mockParams = 'country=argentina&method=bank-transfer&sendMethod=bank'
    setup()
    expect(await screen.findByRole('heading', { name: 'Send' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(mockPush).toHaveBeenCalledWith('/send')
})
