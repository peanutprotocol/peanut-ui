/**
 * Bank-withdraw signing boundary (2026-09-14 Manteca entity split).
 *
 * Drives the page through amount → lock-price → review → Withdraw and pins
 * the money decision AT the signSpend boundary: the depositAddress served
 * by /withdraw/init survives the priceLock state handoff and is the exact
 * recipient signed to; an older API without the field falls back to the
 * legacy constant. Mock strategy mirrors qr-pay-states.test.tsx: mock every
 * hook/service at module level, drive the rendered page.
 */
/* eslint-disable react/display-name */
import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// ---------- module-level mocks ----------

const mockSearchParams = new Map<string, string>()
jest.mock('next/navigation', () => ({
    useSearchParams: () => ({ get: (key: string) => mockSearchParams.get(key) ?? null }),
    useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn(), prefetch: jest.fn() }),
    usePathname: () => '/withdraw/manteca',
    useParams: () => ({}),
}))
jest.mock('next/image', () => (props: Record<string, unknown>) => {
    return React.createElement('img', props as object)
})

const mockSignSpend = jest.fn()
jest.mock('@/hooks/wallet/useSignSpendBundle', () => ({
    useSignSpendBundle: () => ({ signSpend: mockSignSpend }),
}))
jest.mock('@/hooks/wallet/useWallet', () => ({
    useWallet: () => ({ spendableBalance: 1_000_000_000n, formattedSpendableBalance: '1000.00' }),
}))
jest.mock('@/hooks/wallet/useStaleSessionGuard', () => ({
    useStaleSessionGuard: () => jest.fn(async () => false),
}))
jest.mock('@/hooks/wallet/spendPreflight', () => ({
    SessionKeyGrantRequiredError: class SessionKeyGrantRequiredError extends Error {},
}))
jest.mock('@/hooks/useRainCardOverview', () => ({
    useRainCardOverview: () => ({ overview: null }),
}))
jest.mock('@/hooks/useSafeBack', () => ({ useSafeBack: () => jest.fn() }))
jest.mock('@/hooks/useFriendlyError', () => ({
    useFriendlyError: () => (e: unknown) => ({ kind: 'message', message: String(e) }),
}))
jest.mock('@/hooks/wallet/usePendingTransactions', () => ({
    usePendingTransactions: () => ({ hasPendingTransactions: false }),
}))
jest.mock('@/hooks/useIdentityVerification', () => ({
    useIdentityVerification: () => ({ isVerified: true }),
}))
jest.mock('@/hooks/useCapabilities', () => ({
    useCapabilities: () => ({ rails: [], nextActions: [] }),
}))
jest.mock('@/context/authContext', () => ({
    useAuth: () => ({ user: { user: { userId: 'user-1' } }, isAuthed: true, fetchUser: jest.fn() }),
}))
jest.mock('@/utils/regions.utils', () => ({
    ...jest.requireActual('@/utils/regions.utils'),
    isVerifiedForCountry: () => true,
    deriveProviderRejection: () => null,
}))
jest.mock('@/hooks/useMultiPhaseKycFlow', () => ({
    useMultiPhaseKycFlow: () => ({
        isLoading: false,
        error: null,
        phase: null,
        start: jest.fn(),
        reset: jest.fn(),
        config: null,
        sdkToken: null,
        handleInitiateKyc: jest.fn(),
    }),
}))
jest.mock('@/hooks/useCurrency', () => ({
    useCurrency: () => ({
        code: 'ars',
        price: { sell: '1300', buy: '1300' },
        isLoading: false,
        refetch: jest.fn(),
    }),
}))
jest.mock('@/features/limits/hooks/useLimitsValidation', () => ({
    useLimitsValidation: () => ({ isBlocking: false, isWarning: false, currency: 'USD' }),
}))
jest.mock('@/features/limits/utils', () => ({
    ...jest.requireActual('@/features/limits/utils'),
    getLimitsWarningCardProps: () => null,
    isBrUserEligibleForLimitIncrease: () => false,
}))
jest.mock('@/context/ModalsContext', () => ({
    useModalsContext: () => ({ setIsSupportModalOpen: jest.fn(), openSupportWithMessage: jest.fn() }),
}))
jest.mock('@/components/Kyc/InitiateKycModal', () => ({ InitiateKycModal: () => null }))
jest.mock('@/components/Kyc/SumsubKycModals', () => ({ SumsubKycModals: () => null }))
jest.mock('@/components/Kyc/SumsubKycWrapper', () => ({ SumsubKycWrapper: () => null }))
jest.mock('@/components/Global/NavHeader', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Global/RateUnavailable/RateGateScreen', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Global/SoundPlayer', () => ({ SoundPlayer: () => null }))
jest.mock('@/components/Withdraw/views/PixKeySend.view', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Global/Banner/MantecaTransfersMaintenanceView', () => ({
    MantecaTransfersMaintenanceView: () => null,
}))
jest.mock('@/config/underMaintenance.config', () => ({
    __esModule: true,
    default: { disabledMantecaCurrencies: [] },
    underMaintenanceConfig: { disabledMantecaCurrencies: [] },
}))
jest.mock('@/utils/network-triage', () => ({
    captureNetworkTriagedFailure: jest.fn(),
    isNetworkLayerFailure: () => false,
}))
jest.mock('posthog-js', () => ({ capture: jest.fn(), default: { capture: jest.fn() } }))
jest.mock('@sentry/nextjs', () => ({
    captureException: jest.fn(),
    captureMessage: jest.fn(),
    withScope: (cb: (scope: Record<string, jest.Mock>) => void) =>
        cb(
            new Proxy({} as Record<string, jest.Mock>, {
                get: () => jest.fn(),
            })
        ),
}))

// Amount entry, simplified to a single input driving BOTH denominations.
jest.mock('@/components/Global/AmountInput', () => (props: Record<string, unknown>) => {
    const setPrimary = props.setPrimaryAmount as (v: string) => void
    const setSecondary = props.setSecondaryAmount as (v: string) => void
    return (
        <input
            data-testid="amount-input"
            onChange={(e) => {
                setSecondary(e.target.value)
                setPrimary((Number(e.target.value) * 1300).toFixed(2))
            }}
        />
    )
})

const mockInitiateWithdraw = jest.fn()
const mockWithdrawWithSignedTx = jest.fn()
jest.mock('@/services/manteca', () => ({
    ...jest.requireActual('@/services/manteca'),
    mantecaApi: {
        initiateWithdraw: (...args: unknown[]) => mockInitiateWithdraw(...args),
        withdrawWithSignedTx: (...args: unknown[]) => mockWithdrawWithSignedTx(...args),
    },
}))

import MantecaWithdrawPage from '../page'

const SERVED_ADDRESS = '0x49200bF84dC26349C86ce040019063FeCE88CB1c'
const LEGACY_ADDRESS = '0x959e088a09f61aB01cb83b0eBCc74b2CF6d62053'

function renderPage() {
    mockSearchParams.clear()
    mockSearchParams.set('country', 'argentina')
    mockSearchParams.set('method', 'bank')
    mockSearchParams.set('destination', '0000003100064523644259')
    mockSearchParams.set('isSavedAccount', 'true')
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
        <IntlWrapper>
            <QueryClientProvider client={queryClient}>
                <MantecaWithdrawPage />
            </QueryClientProvider>
        </IntlWrapper>
    )
}

async function driveToWithdraw(priceLock: Record<string, unknown>) {
    mockInitiateWithdraw.mockResolvedValue({ data: priceLock })
    renderPage()

    fireEvent.change(await screen.findByTestId('amount-input'), { target: { value: '10' } })
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    await waitFor(() => expect(mockInitiateWithdraw).toHaveBeenCalledTimes(1))

    const withdrawButton = await screen.findByRole('button', { name: /withdraw/i })
    await act(async () => {
        fireEvent.click(withdrawButton)
    })
    await waitFor(() => expect(mockSignSpend).toHaveBeenCalledTimes(1))
}

beforeEach(() => {
    jest.clearAllMocks()
    mockSignSpend.mockResolvedValue({
        strategy: 'smart-only',
        signedUserOp: {
            signedUserOp: { sender: '0x1', nonce: '0x0', callData: '0x', signature: '0x' },
            chainId: '42161',
            entryPointAddress: '0xentry',
        },
    })
    mockWithdrawWithSignedTx.mockResolvedValue({ data: { id: 'synthetic-1' } })
})

describe('bank-withdraw recipient at the signing boundary', () => {
    test('the API-served entity depositAddress survives the priceLock handoff and reaches signSpend', async () => {
        await driveToWithdraw({
            priceLockCode: 'pl-1',
            price: '1300',
            expiresAt: '2026-09-14T00:00:00Z',
            usdAmount: '10',
            fiatAmount: '13000.00',
            currency: 'ars',
            depositAddress: SERVED_ADDRESS,
        })

        expect(mockSignSpend).toHaveBeenCalledWith(expect.objectContaining({ recipient: SERVED_ADDRESS }))
    })

    test('an older API without the field falls back to the legacy constant', async () => {
        await driveToWithdraw({
            priceLockCode: 'pl-1',
            price: '1300',
            expiresAt: '2026-09-14T00:00:00Z',
            usdAmount: '10',
            fiatAmount: '13000.00',
            currency: 'ars',
        })

        expect(mockSignSpend).toHaveBeenCalledWith(expect.objectContaining({ recipient: LEGACY_ADDRESS }))
    })
})
