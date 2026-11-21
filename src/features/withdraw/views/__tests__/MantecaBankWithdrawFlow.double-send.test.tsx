/**
 * Replays the ChargeSendFlow.tla counterexamples on the Manteca bank
 * withdrawal (mono engineering/api/state-machines/ChargeSendFlow.tla). The
 * backend submits the signed spend before it creates the Manteca order, so a
 * lost answer to the final submit may hide money that moved. Before the shared
 * guard that answer showed "could not complete" with Try again, which took a
 * new quote and started a second withdrawal.
 */
import React from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'

// ---------- module-level mocks ----------

jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), prefetch: jest.fn() }),
}))
jest.mock('next-intl', () => ({
    useTranslations: (ns: string) => (key: string) => `${ns}.${key}`,
}))
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))
jest.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({ invalidateQueries: jest.fn() }) }))
jest.mock('@/context/authContext', () => ({
    useAuth: () => ({
        user: { user: { userId: 'u1' }, accounts: [{ id: 'acct-1', type: 'manteca', identifier: 'mi.alias.peanut' }] },
    }),
}))

const mockStepper = { step: 'amount' as string, goTo: jest.fn(), back: jest.fn(), reset: jest.fn(), isFirst: false }
jest.mock('@/hooks/useFlowStepper', () => ({ useFlowStepper: () => mockStepper }))
jest.mock('@/features/withdraw/useWithdrawAmount', () => ({ useWithdrawAmount: () => ['50', jest.fn()] }))
jest.mock('@/hooks/useSendFlowOrigin', () => ({ useSendFlowOrigin: () => ({ isFromSendFlow: false }) }))
jest.mock('@/hooks/useSafeBack', () => ({ useSafeBack: () => jest.fn(), useReturnTo: () => jest.fn() }))
jest.mock('@/hooks/useFriendlyError', () => ({
    useFriendlyError: () => (err: unknown) => (err instanceof Error ? err.message : String(err)),
}))

const WALLET = '0x2222222222222222222222222222222222222222'
jest.mock('@/hooks/wallet/useWallet', () => ({
    useWallet: () => ({
        address: WALLET,
        spendableBalance: 100n * 10n ** 6n,
        formattedSpendableBalance: '100.00',
        spendableBalanceDecimal: 100,
    }),
}))
const mockSignSpend = jest.fn()
jest.mock('@/hooks/wallet/useSignSpendBundle', () => ({ useSignSpendBundle: () => ({ signSpend: mockSignSpend }) }))
jest.mock('@/hooks/wallet/useRainControllerRepair', () => ({ useRainControllerRepair: () => jest.fn() }))
jest.mock('@/hooks/wallet/useSignedSpendRecovery', () => ({ useSignedSpendRecovery: () => async () => null }))
jest.mock('@/hooks/wallet/useStaleSessionGuard', () => ({ useStaleSessionGuard: () => () => false }))
jest.mock('@/hooks/wallet/usePendingTransactions', () => ({
    usePendingTransactions: () => ({ hasPendingTransactions: false }),
}))
jest.mock('@/hooks/useRainCardOverview', () => ({ useRainCardOverview: () => ({ overview: null }) }))
jest.mock('@/context/loadingStates.context', () => {
    const ReactActual = jest.requireActual('react')
    return {
        loadingStateContext: ReactActual.createContext({
            isLoading: false,
            loadingState: 'Idle',
            setLoadingState: () => {},
        }),
    }
})
jest.mock('@/context/ModalsContext', () => ({
    useModalsContext: () => ({ setIsSupportModalOpen: jest.fn(), openSupportWithMessage: jest.fn() }),
}))
jest.mock('@/hooks/useCapabilities', () => ({ useCapabilities: () => ({ rails: [], nextActions: [] }) }))
jest.mock('@/hooks/useIdentityVerification', () => ({ useIdentityVerification: () => ({ isVerified: true }) }))
jest.mock('@/utils/provider-rejection.utils', () => ({ deriveProviderRejection: () => ({ state: 'none' }) }))
jest.mock('@/hooks/useMultiPhaseKycFlow', () => ({
    useMultiPhaseKycFlow: () => ({ isModalOpen: false, errorCooldown: null, error: null }),
}))
jest.mock('@/hooks/usePointsCalculation', () => ({
    usePointsCalculation: () => ({ pointsData: null, pointsDivRef: { current: null } }),
}))
jest.mock('@/hooks/usePointsConfetti', () => ({ usePointsConfetti: () => {} }))
jest.mock('@/hooks/useCurrency', () => ({
    useCurrency: () => ({ code: 'ARS', price: { sell: 1000, buy: 1000 }, isLoading: false, refetch: jest.fn() }),
}))
jest.mock('@/features/limits/hooks/useLimitsValidation', () => ({
    useLimitsValidation: () => ({ isLoading: false, isBlocking: false, currency: 'ARS', servedByAvenia: false }),
}))
jest.mock('@/features/limits/utils', () => ({
    getLimitsWarningCardProps: () => null,
    isBrUserEligibleForLimitIncrease: () => false,
}))
jest.mock('@/hooks/useSumsubActionFlow', () => ({
    useSumsubActionFlow: () => ({ showWrapper: false, isLoading: false, handleInitiate: jest.fn() }),
}))
jest.mock('@/app/actions/increase-limits', () => ({ initiateIncreaseLimits: jest.fn() }))
jest.mock('@/hooks/useLimits', () => ({ useLimits: () => ({ mantecaLimits: null, refetch: jest.fn() }) }))
jest.mock('@/utils/regions.utils', () => ({ isVerifiedForCountry: () => true }))
jest.mock('@/components/AddMoney/consts', () => ({
    countryData: [{ type: 'country', path: 'argentina', id: 'AR', iso2: 'AR', currency: 'ARS', title: 'Argentina' }],
}))
jest.mock('@/utils/withdraw.utils', () => ({ validateCbuCvuAlias: () => ({ valid: true }) }))
jest.mock('@/utils/network-triage', () => ({
    captureNetworkTriagedFailure: jest.fn(),
    isNetworkLayerFailure: (error: unknown) => error instanceof TypeError,
}))
const mockReadUserOpOutcome = jest.fn()
jest.mock('@/utils/userop-outcome', () => ({
    readUserOpOutcome: (...args: unknown[]) => mockReadUserOpOutcome(...args),
}))
const mockInitiateWithdraw = jest.fn()
const mockWithdrawWithSignedTx = jest.fn()
jest.mock('@/services/manteca', () => ({
    mantecaApi: {
        initiateWithdraw: (...args: unknown[]) => mockInitiateWithdraw(...args),
        withdrawWithSignedTx: (...args: unknown[]) => mockWithdrawWithSignedTx(...args),
    },
}))
jest.mock('@/services/rain', () => ({ rainApi: { getWithdrawalStatus: jest.fn() } }))

// views: stubs that expose what the flow decides
const Passthrough = ({ children }: { children?: React.ReactNode }) => <>{children}</>
const Nothing = () => null
jest.mock('@/components/Global/AmountInput', () => ({ __esModule: true, default: Nothing }))
jest.mock('@/components/Global/NavHeader', () => ({ __esModule: true, default: Nothing }))
jest.mock('@/components/Global/SoundPlayer', () => ({ SoundPlayer: Nothing }))
jest.mock('@/components/Common/PointsCard', () => ({ __esModule: true, default: Nothing }))
jest.mock('@/components/Global/ValidatedInput', () => ({ __esModule: true, default: Nothing }))
jest.mock('@/components/0_Bruddle/BaseSelect', () => ({ __esModule: true, default: Nothing }))
jest.mock('@/components/Profile/AvatarWithBadge', () => ({ __esModule: true, default: Nothing }))
jest.mock('@/components/Kyc/InitiateKycModal', () => ({ InitiateKycModal: Nothing }))
jest.mock('@/components/Kyc/SumsubKycModals', () => ({ SumsubKycModals: Nothing }))
jest.mock('@/components/Kyc/SumsubKycWrapper', () => ({ SumsubKycWrapper: Nothing }))
jest.mock('@/features/limits/components/LimitsWarningCard', () => ({ __esModule: true, default: Nothing }))
jest.mock('@/components/Payment/PaymentInfoRow', () => ({ PaymentInfoRow: Nothing }))
jest.mock('@/components/0_Bruddle/Field', () => ({ Field: Passthrough }))
jest.mock('@/components/0_Bruddle/Callout', () => ({ Callout: Passthrough }))
jest.mock('@/features/paperwork-verification/analytics', () => ({ KycControlFlowProvider: Passthrough }))
jest.mock('@/components/Global/RainCooldown/CooldownErrorText', () => ({
    __esModule: true,
    default: ({ message }: { message: string }) => <p role="alert">{message}</p>,
}))
jest.mock('@/components/Global/EmptyStates/CenteredStatusCard', () => ({
    __esModule: true,
    default: ({ title, children }: { title: string; children?: React.ReactNode }) => (
        <div>
            <h1>{title}</h1>
            {children}
        </div>
    ),
}))
jest.mock('@/features/payments/shared/components/PaymentConfirmingView', () => ({
    PaymentConfirmingView: () => <div data-testid="payment-confirming" />,
}))
jest.mock('@/components/0_Bruddle/Button', () => ({
    Button: ({
        children,
        onClick,
        disabled,
    }: {
        children?: React.ReactNode
        onClick?: () => void
        disabled?: boolean
    }) => (
        <button onClick={onClick} disabled={disabled}>
            {children}
        </button>
    ),
}))

import MantecaBankWithdrawFlow from '../MantecaBankWithdrawFlow'

// ---------- helpers ----------

const DESTINATION = 'mi.alias.peanut'
const MARKER_KEY = `peanut:pendingChargeSend:u1:withdraw-manteca:${DESTINATION}`
const searchParams = new URLSearchParams({ country: 'argentina', account: 'acct-1' })
const LOCK = {
    priceLockCode: 'lock-1',
    price: '1000',
    expiresAt: new Date(Date.now() + 600_000).toISOString(),
    expiresInMs: 600_000,
    usdAmount: '50',
    fiatAmount: '50000',
    currency: 'ARS',
}
const SIGNED = {
    strategy: 'smart-only',
    signedUserOp: {
        signedUserOp: {
            sender: WALLET,
            nonce: 7n,
            callData: '0x',
            callGasLimit: 1n,
            verificationGasLimit: 1n,
            preVerificationGas: 1n,
            maxFeePerGas: 1n,
            maxPriorityFeePerGas: 1n,
            signature: '0x',
        },
        chainId: '42161',
        entryPointAddress: '0x0000000071727De22E5E9d8BAf0edAc6f37da032',
    },
}

const flush = async () => {
    await act(async () => {
        await jest.advanceTimersByTimeAsync(0)
    })
}

/** Locks the quote from the amount step, then shows the review. */
async function openReview() {
    const view = render(<MantecaBankWithdrawFlow searchParams={searchParams} />)
    await flush()
    fireEvent.click(screen.getByText('common.continue'))
    await flush()
    expect(mockInitiateWithdraw).toHaveBeenCalledTimes(1)
    mockStepper.step = 'review'
    view.rerender(<MantecaBankWithdrawFlow searchParams={searchParams} />)
    return view
}
const withdrawButton = () => screen.getByText('navigation.withdraw')

beforeEach(() => {
    jest.useFakeTimers()
    jest.clearAllMocks()
    window.localStorage.clear()
    mockStepper.step = 'amount'
    mockStepper.goTo.mockImplementation((step: string) => {
        mockStepper.step = step
        return Promise.resolve()
    })
    mockInitiateWithdraw.mockResolvedValue({ data: LOCK })
    mockSignSpend.mockResolvedValue(SIGNED)
    mockReadUserOpOutcome.mockResolvedValue('unknown')
})
afterEach(() => {
    jest.clearAllTimers()
    jest.useRealTimers()
})

// ---------- tests ----------

it('a lost answer to the final submit reads the withdrawal back: no failure screen, no Try again, no new quote', async () => {
    mockWithdrawWithSignedTx.mockRejectedValue(new TypeError('Failed to fetch'))
    mockReadUserOpOutcome.mockResolvedValue({ executed: '0xfound' })
    const view = await openReview()

    fireEvent.click(withdrawButton())
    await flush()
    view.rerender(<MantecaBankWithdrawFlow searchParams={searchParams} />)

    expect(mockReadUserOpOutcome).toHaveBeenCalledWith(expect.objectContaining({ nonce: '7' }), WALLET)
    expect(screen.getByTestId('payment-confirming')).toBeInTheDocument()
    expect(screen.queryByText('common.withdrawalCouldNotComplete')).toBeNull()
    expect(screen.queryByText('common.tryAgain')).toBeNull()
    expect(mockStepper.step).not.toBe('failure')
    expect(mockInitiateWithdraw).toHaveBeenCalledTimes(1)
    expect(mockWithdrawWithSignedTx).toHaveBeenCalledTimes(1)
})

it('a backend that fails without a reason after it may have submitted is read back too', async () => {
    mockWithdrawWithSignedTx.mockResolvedValue({ error: 'Unexpected error' })
    mockReadUserOpOutcome.mockResolvedValue({ executed: '0xfound' })
    const view = await openReview()

    fireEvent.click(withdrawButton())
    await flush()
    view.rerender(<MantecaBankWithdrawFlow searchParams={searchParams} />)

    expect(screen.getByTestId('payment-confirming')).toBeInTheDocument()
    expect(screen.queryByText('common.tryAgain')).toBeNull()
    expect(mockStepper.step).not.toBe('failure')
})

it('while the outcome is unknown, a revisit resumes the read and offers no new quote', async () => {
    mockWithdrawWithSignedTx.mockRejectedValue(new TypeError('Failed to fetch'))
    const view = await openReview()
    fireEvent.click(withdrawButton())
    await act(async () => {
        await jest.advanceTimersByTimeAsync(65_000)
    })
    expect(window.localStorage.getItem(MARKER_KEY)).not.toBeNull()
    view.unmount()

    // a new visit opens on the amount step: the recovery resumes and says the outcome is unknown
    mockStepper.step = 'amount'
    const revisit = render(<MantecaBankWithdrawFlow searchParams={searchParams} />)
    await flush()
    expect(mockReadUserOpOutcome.mock.calls.length).toBeGreaterThan(1)
    expect(screen.getByTestId('payment-confirming')).toBeInTheDocument()
    expect(screen.queryByText('common.continue')).toBeNull()
    expect(mockInitiateWithdraw).toHaveBeenCalledTimes(1)
    expect(mockSignSpend).toHaveBeenCalledTimes(1)
    // leaving ends the resumed recovery at its next step
    revisit.unmount()
    await act(async () => {
        await jest.advanceTimersByTimeAsync(5_000)
    })
})

it('the review comes back once the chain proves nothing moved', async () => {
    mockWithdrawWithSignedTx.mockRejectedValue(new TypeError('Failed to fetch'))
    mockReadUserOpOutcome.mockResolvedValue('replaced')
    const view = await openReview()

    fireEvent.click(withdrawButton())
    await flush()
    view.rerender(<MantecaBankWithdrawFlow searchParams={searchParams} />)

    expect(mockStepper.step).toBe('review')
    expect(screen.getByRole('alert')).toHaveTextContent('payment.errors.paymentNotSent')
    expect(window.localStorage.getItem(MARKER_KEY)).toBeNull()
    expect(withdrawButton()).not.toBeDisabled()
})

it('two taps in one tick sign and submit one withdrawal', async () => {
    mockWithdrawWithSignedTx.mockResolvedValue({ data: {} })
    await openReview()

    act(() => {
        fireEvent.click(withdrawButton())
        fireEvent.click(withdrawButton())
    })
    await flush()

    expect(mockSignSpend).toHaveBeenCalledTimes(1)
    expect(mockWithdrawWithSignedTx).toHaveBeenCalledTimes(1)
})

it('a refusal the provider names keeps its message and the review (no regression)', async () => {
    mockWithdrawWithSignedTx.mockResolvedValue({ error: 'refused', code: 'PROVIDER_REJECTED' })
    const view = await openReview()

    fireEvent.click(withdrawButton())
    await flush()
    view.rerender(<MantecaBankWithdrawFlow searchParams={searchParams} />)

    expect(screen.getByRole('alert')).toHaveTextContent('errors.providerRejected')
    expect(screen.queryByTestId('payment-confirming')).toBeNull()
    expect(window.localStorage.getItem(MARKER_KEY)).toBeNull()
})
