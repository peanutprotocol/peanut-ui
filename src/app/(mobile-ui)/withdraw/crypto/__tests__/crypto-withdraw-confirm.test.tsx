/**
 * Crypto Withdraw — Confirm Flow Tests
 *
 * Regression net for the "successful withdrawal stuck PENDING / missing from
 * Activity" bug: same-chain collateral-routed withdraws must pass the charge
 * uuid into sendMoney (so the backend settles the charge server-side) and must
 * ALWAYS call recordPayment (mixed spends rely on it; collateral-only uses it
 * as the idempotent recovery net). A recordPayment failure after funds moved
 * must degrade to the success view on collateral-routed paths, while
 * smart-only keeps its historical hard-fail behavior.
 *
 * Strategy (same as withdraw-states.test.tsx): mock every hook/service at the
 * module level; assert on the context-setter mocks rather than re-rendering.
 */
import React from 'react'
import { render as rtlRender, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'

// ---------- module-level mocks ----------

jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn(), prefetch: jest.fn() }),
    useSearchParams: () => ({ get: () => null }),
    usePathname: () => '/withdraw/crypto',
}))

const mockCaptureMessage = jest.fn()
const mockCaptureException = jest.fn()
jest.mock('@sentry/nextjs', () => ({
    captureMessage: (...args: unknown[]) => mockCaptureMessage(...args),
    captureException: (...args: unknown[]) => mockCaptureException(...args),
}))

const mockPosthogCapture = jest.fn()
jest.mock('posthog-js', () => ({
    __esModule: true,
    default: { capture: (...args: unknown[]) => mockPosthogCapture(...args), init: jest.fn() },
}))

jest.mock('use-haptic', () => ({
    useHaptic: () => ({ triggerHaptic: jest.fn() }),
}))

jest.mock('@/hooks/useSafeBack', () => ({
    useSafeBack: () => jest.fn(),
}))

jest.mock('@/context/tokenSelector.context', () => {
    const ReactActual = jest.requireActual('react')
    return {
        tokenSelectorContext: ReactActual.createContext({ resetTokenContextProvider: jest.fn() }),
    }
})

jest.mock('@/constants/zerodev.consts', () => ({
    PEANUT_WALLET_CHAIN: { id: 42161 },
    PEANUT_WALLET_TOKEN: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    PEANUT_WALLET_TOKEN_DECIMALS: 6,
}))

jest.mock('@/constants/general.consts', () => ({
    ROUTE_NOT_FOUND_ERROR: 'No route found',
}))

jest.mock('@/constants/analytics.consts', () => ({
    ANALYTICS_EVENTS: {
        WITHDRAW_CONFIRMED: 'withdraw_confirmed',
        WITHDRAW_COMPLETED: 'withdraw_completed',
        WITHDRAW_FAILED: 'withdraw_failed',
    },
}))

jest.mock('@/utils/token.utils', () => ({
    NATIVE_TOKEN_ADDRESS: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
}))

jest.mock('@/utils/cross-chain-fee.utils', () => ({
    isWithdrawFeeDisproportionate: () => false,
}))

const mockIsAmountWithinBalance = jest.fn((..._args: unknown[]) => true)
jest.mock('@/utils/balance.utils', () => ({
    isAmountWithinBalance: (...args: unknown[]) => mockIsAmountWithinBalance(...args),
}))

jest.mock('@/utils/withdraw.utils', () => ({
    ...jest.requireActual('@/utils/withdraw.utils'),
    isBelowRhinoMinDeposit: () => false,
}))

jest.mock('@/utils/general.utils', () => ({
    isTxReverted: (receipt: { status?: string } | null) => receipt?.status === 'reverted',
    printableAddress: (address: string) => `${address.slice(0, 6)}...${address.slice(-4)}`,
    validateEnsName: (name: string | undefined) => name === 'alice.eth',
}))

jest.mock('@/utils/url.utils', () => ({
    appBaseUrl: () => 'https://peanut.test',
}))

jest.mock('@/utils/friendly-error.utils', () => ({
    ErrorHandler: (err: unknown) => (err instanceof Error ? err.message : 'Something went wrong'),
}))

jest.mock('@/hooks/useFriendlyError', () => ({
    useFriendlyError: () => (err: unknown) => (err instanceof Error ? err.message : 'Something went wrong'),
}))

jest.mock('@/interfaces/peanut-sdk-types', () => ({
    EPeanutLinkType: { native: 0, erc20: 1 },
}))

jest.mock('@/services/charges', () => ({
    chargesApi: { create: jest.fn(), get: jest.fn(), cancel: jest.fn().mockResolvedValue(undefined) },
}))

jest.mock('@/services/requests', () => ({
    requestsApi: { create: jest.fn() },
}))

// ---------- view mocks ----------

jest.mock('@/features/withdraw/views/ConfirmWithdrawView', () => ({
    __esModule: true,
    default: (props: { onConfirm: () => void; onBack: () => void }) => (
        <>
            <button data-testid="back-review" onClick={props.onBack}>
                Back
            </button>
            <button data-testid="confirm-withdraw" onClick={props.onConfirm}>
                Confirm
            </button>
        </>
    ),
}))

// exposes onReview so the setup (request/charge creation) path is testable
jest.mock('@/features/withdraw/views/InitialWithdrawView', () => ({
    __esModule: true,
    default: (props: { onReview: (data: unknown) => void }) => (
        <button data-testid="review-cta" onClick={() => props.onReview(withdrawData)}>
            Review
        </button>
    ),
}))

jest.mock('@/features/payments/shared/components/PaymentSuccessView', () => ({
    __esModule: true,
    default: () => <div data-testid="payment-success" />,
}))

jest.mock('@/components/Global/ActionModal', () => ({
    __esModule: true,
    default: ({ visible, onClose }: { visible: boolean; onClose: () => void }) =>
        visible ? (
            <button data-testid="modal-close" onClick={onClose}>
                Close
            </button>
        ) : null,
}))

jest.mock('@/components/Global/AddressLink', () => ({
    __esModule: true,
    default: (props: { address: string }) => <span>{props.address}</span>,
}))

jest.mock('@/components/Global/Loading', () => ({
    __esModule: true,
    default: (props: any) =>
        props.variant === 'mascot' ? (
            <div data-testid="loading">{props.message && <span>{props.message}</span>}</div>
        ) : (
            <div data-testid="loading-spinner" />
        ),
}))

jest.mock('@/components/0_Bruddle/SlideToConfirm', () => ({
    __esModule: true,
    default: () => <div data-testid="slider" />,
}))

// ---------- flow hooks ----------

const CHARGE_UUID = 'charge-uuid-123'
const RECIPIENT = '0x1111111111111111111111111111111111111111'
const USER_ADDRESS = '0x2222222222222222222222222222222222222222'

// URL stepper: the page renders by stepper.step and advances via goTo
const mockStepperGoTo = jest.fn()
const mockStepper = {
    step: 'review' as string,
    goTo: mockStepperGoTo,
    back: jest.fn(),
    reset: jest.fn(),
    isFirst: false,
}
const mockStepperOptions = jest.fn()
jest.mock('@/hooks/useFlowStepper', () => ({
    useFlowStepper: (options: unknown) => {
        mockStepperOptions(options)
        return mockStepper
    },
}))
// mutable so tests can hand the page a tampered ?amount= (Chip round 4)
let mockUrlAmount = '50'
jest.mock('@/features/withdraw/useWithdrawAmount', () => ({
    useWithdrawAmount: () => [mockUrlAmount, jest.fn()],
}))
const mockSetPaymentDetails = jest.fn()
const mockSetTransactionHash = jest.fn()
const mockSetPaymentError = jest.fn()
const mockSetWithdrawError = jest.fn()

const chargeDetails = {
    uuid: CHARGE_UUID,
    tokenAddress: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    tokenAmount: '50',
    tokenDecimals: 6,
    tokenType: '1',
    chainId: '42161',
    requestLink: { recipientAddress: RECIPIENT },
}

const withdrawData = {
    address: RECIPIENT,
    token: { address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', symbol: 'USDC', decimals: 6, price: 1 },
    chain: { chainId: 42161, name: 'Arbitrum' },
    amount: '50',
}

const mockSetRecipient = jest.fn()
const mockSetIsValidRecipient = jest.fn()
const mockWithdrawFlow = {
    isMaxWithdrawal: false,
    setIsMaxWithdrawal: jest.fn(),
    withdrawData,
    recipient: { address: RECIPIENT, name: '' },
    transactionHash: null as string | null,
    setRecipient: mockSetRecipient,
    setIsValidRecipient: mockSetIsValidRecipient,
    setWithdrawData: jest.fn(),
    showCompatibilityModal: false,
    setShowCompatibilityModal: jest.fn(),
    isPreparingReview: false,
    setIsPreparingReview: jest.fn(),
    paymentError: null,
    setPaymentError: mockSetPaymentError,
    setError: mockSetWithdrawError,
    chargeDetails,
    setChargeDetails: jest.fn(),
    setTransactionHash: mockSetTransactionHash,
    paymentDetails: null,
    setPaymentDetails: mockSetPaymentDetails,
    resetWithdrawFlow: jest.fn(),
}

jest.mock('@/features/withdraw/WithdrawFlowContext', () => ({
    useWithdrawFlow: () => mockWithdrawFlow,
}))

const mockSendMoney = jest.fn()
const mockSendTransactions = jest.fn()
// mutable so the frozen-spend tests can move the balance between setup and confirm
const mockWalletState = { spendableBalance: (100n * 10n ** 6n) as bigint | undefined }
jest.mock('@/hooks/wallet/useWallet', () => ({
    useWallet: () => ({
        isConnected: true,
        address: USER_ADDRESS,
        sendMoney: mockSendMoney,
        sendTransactions: mockSendTransactions,
        spendableBalance: mockWalletState.spendableBalance,
    }),
}))

// Same-chain, same-token route: isXChain/isDiffToken false → sendMoney path.
const mockCrossChainTransfer = {
    transactions: [{ to: RECIPIENT, value: 0n, data: '0x' }],
    receiveAmount: '50',
    payAmount: null,
    feeUsd: 0,
    minDepositLimitUsd: 0,
    isCalculating: false,
    isXChain: false,
    isDiffToken: false,
    isFeeEstimationError: false,
    quoteExpiresAt: null as string | null,
    error: null,
    calculate: jest.fn(),
    reset: jest.fn(),
}
jest.mock('@/features/payments/shared/hooks/useCrossChainTransfer', () => ({
    useCrossChainTransfer: () => mockCrossChainTransfer,
}))

const mockRecordPayment = jest.fn()
jest.mock('@/features/payments/shared/hooks/usePaymentRecorder', () => ({
    usePaymentRecorder: () => ({
        isRecording: false,
        error: null,
        recordPayment: mockRecordPayment,
        reset: jest.fn(),
    }),
}))
// address book: react-query backed; these tests pin the charge-completion paths only
jest.mock('@/hooks/useSavedAddresses', () => ({
    useSavedAddresses: () => ({
        savedAddresses: [],
        isLoading: false,
        findSaved: () => undefined,
        save: { mutate: jest.fn() },
        rename: { mutateAsync: jest.fn() },
        remove: { mutateAsync: jest.fn() },
    }),
}))

import WithdrawCryptoPage from '../page'
import { chargesApi } from '@/services/charges'
import { requestsApi } from '@/services/requests'

const render = (ui: React.ReactElement, options?: Omit<Parameters<typeof rtlRender>[1], 'wrapper'>) =>
    rtlRender(ui, { wrapper: IntlWrapper, ...options })

// ---------- helpers ----------

const PAYMENT_RESULT = { uuid: 'payment-1' }

const confirm = async () => {
    render(<WithdrawCryptoPage />)
    fireEvent.click(screen.getByTestId('confirm-withdraw'))
}

beforeEach(() => {
    mockWithdrawFlow.showCompatibilityModal = false
    jest.clearAllMocks()
    mockRecordPayment.mockResolvedValue(PAYMENT_RESULT)
    Object.assign(mockCrossChainTransfer, { isXChain: false, isDiffToken: false, quoteExpiresAt: null })
    mockUrlAmount = '50'
    mockStepper.step = 'review'
    mockWithdrawFlow.isMaxWithdrawal = false
    mockWalletState.spendableBalance = 100n * 10n ** 6n
    mockIsAmountWithinBalance.mockReset()
    mockIsAmountWithinBalance.mockImplementation(() => true)
})

describe('crypto withdraw preparation', () => {
    it('creates a standalone WITHDRAW charge without an existing request link', async () => {
        mockStepper.step = 'recipient'
        mockWithdrawFlow.recipient.name = ' Alice.eth '
        jest.mocked(chargesApi.create).mockResolvedValue({ data: { id: CHARGE_UUID } } as never)
        jest.mocked(chargesApi.get).mockResolvedValue(chargeDetails as never)
        try {
            render(<WithdrawCryptoPage />)
            fireEvent.click(screen.getByTestId('review-cta'))
            await waitFor(() => expect(mockWithdrawFlow.setShowCompatibilityModal).toHaveBeenCalledWith(true))
            expect(requestsApi.create).not.toHaveBeenCalled()
            expect(chargesApi.create).toHaveBeenCalledTimes(1)
            const [payload] = jest.mocked(chargesApi.create).mock.calls[0]
            expect(payload).not.toHaveProperty('requestId')
            expect(payload).toMatchObject({
                transactionType: 'WITHDRAW',
                local_price: { amount: '50', currency: 'USD' },
                requestProps: {
                    recipientAddress: RECIPIENT,
                    recipientEnsName: 'alice.eth',
                    chainId: '42161',
                    tokenAmount: '50.000000',
                    tokenAddress: withdrawData.token.address,
                    tokenDecimals: 6,
                    tokenType: 1,
                    tokenSymbol: 'USDC',
                },
            })
            expect(mockWithdrawFlow.setChargeDetails).toHaveBeenLastCalledWith(chargeDetails)
        } finally {
            mockStepper.step = 'review'
        }
    })
})

describe('crypto withdraw confirm — expired Rhino quote', () => {
    afterEach(() => jest.useRealTimers())

    it('re-quotes instead of signing when the quote aged out while the screen sat open', async () => {
        jest.useFakeTimers({ now: new Date('2026-09-01T12:00:00Z') })
        // Fresh at render: expires in 60s.
        Object.assign(mockCrossChainTransfer, {
            isXChain: true,
            quoteExpiresAt: new Date(Date.now() + 60_000).toISOString(),
        })
        render(<WithdrawCryptoPage />)

        const quotesBeforeTap = mockCrossChainTransfer.calculate.mock.calls.length

        // …then the user waits past it. No render happens in between.
        jest.setSystemTime(Date.now() + 120_000)
        fireEvent.click(screen.getByTestId('confirm-withdraw'))

        await waitFor(() => expect(mockCrossChainTransfer.calculate).toHaveBeenCalledTimes(quotesBeforeTap + 1))
        expect(mockSendTransactions).not.toHaveBeenCalled()
        expect(mockSendMoney).not.toHaveBeenCalled()
        expect(mockStepperGoTo).not.toHaveBeenCalledWith('success')
    })

    it('a tap with nothing prepared (an expiry refresh that failed) re-quotes instead of dead-ending', async () => {
        Object.assign(mockCrossChainTransfer, { isXChain: true, transactions: null, quoteExpiresAt: null })
        try {
            render(<WithdrawCryptoPage />)
            const quotesBeforeTap = mockCrossChainTransfer.calculate.mock.calls.length

            fireEvent.click(screen.getByTestId('confirm-withdraw'))

            await waitFor(() => expect(mockCrossChainTransfer.calculate).toHaveBeenCalledTimes(quotesBeforeTap + 1))
            expect(mockSendTransactions).not.toHaveBeenCalled()
            expect(mockSetWithdrawError).not.toHaveBeenCalledWith(expect.objectContaining({ showError: true }))
        } finally {
            Object.assign(mockCrossChainTransfer, { transactions: [{ to: RECIPIENT, value: 0n, data: '0x' }] })
        }
    })

    // A failed quote is copied into the page-level error. If a later tap
    // re-quotes successfully, that copy has to go — otherwise the screen keeps
    // the old failure and a Retry CTA over a route that is actually ready, and
    // the next tap broadcasts under a stale error.
    it('drops the copied route error when a retry re-quotes', async () => {
        Object.assign(mockCrossChainTransfer, {
            isXChain: true,
            transactions: null,
            quoteExpiresAt: null,
            error: 'Rhino route unavailable',
        })
        try {
            render(<WithdrawCryptoPage />)
            // The propagation effect copies the hook's error onto the page.
            await waitFor(() => expect(mockSetPaymentError).toHaveBeenCalledWith('Rhino route unavailable'))
            mockSetPaymentError.mockClear()

            fireEvent.click(screen.getByTestId('confirm-withdraw'))

            await waitFor(() => expect(mockSetPaymentError).toHaveBeenCalledWith(null))
            expect(mockSendTransactions).not.toHaveBeenCalled()
        } finally {
            Object.assign(mockCrossChainTransfer, {
                isXChain: false,
                transactions: [{ to: RECIPIENT, value: 0n, data: '0x' }],
                error: null,
            })
        }
    })

    it('signs while the quote is still fresh', async () => {
        jest.useFakeTimers({ now: new Date('2026-09-01T12:00:00Z') })
        Object.assign(mockCrossChainTransfer, {
            isXChain: true,
            quoteExpiresAt: new Date(Date.now() + 120_000).toISOString(),
        })
        mockSendTransactions.mockResolvedValue({
            userOpHash: '0xuserop',
            receipt: { transactionHash: '0xmined', status: 'success' },
            strategy: 'mixed',
            intentId: 'prep-intent-9',
        })
        render(<WithdrawCryptoPage />)
        // Entering the review step quotes once; the tap must not quote again.
        const quotesBeforeTap = mockCrossChainTransfer.calculate.mock.calls.length

        jest.setSystemTime(Date.now() + 10_000)
        fireEvent.click(screen.getByTestId('confirm-withdraw'))

        await waitFor(() => expect(mockSendTransactions).toHaveBeenCalled())
        expect(mockCrossChainTransfer.calculate).toHaveBeenCalledTimes(quotesBeforeTap)
    })
})

// ---------- tests ----------

describe('crypto withdraw confirm — charge completion', () => {
    it('passes the charge uuid to sendMoney so collateral-only spends settle the charge server-side', async () => {
        mockSendMoney.mockResolvedValue({
            txHash: '0xbetx',
            userOpHash: undefined,
            receipt: null,
            strategy: 'collateral-only',
            intentId: CHARGE_UUID,
        })

        await confirm()

        await waitFor(() => expect(mockStepperGoTo).toHaveBeenCalledWith('success'))
        expect(mockSendMoney).toHaveBeenCalledWith(
            RECIPIENT,
            '50',
            expect.objectContaining({ kind: 'CRYPTO_WITHDRAW', chargeId: CHARGE_UUID })
        )
        // recordPayment fires as the idempotent recovery net (backend already
        // settled the charge via /submit's trusted completion).
        expect(mockRecordPayment).toHaveBeenCalledWith(
            expect.objectContaining({ chargeId: CHARGE_UUID, txHash: '0xbetx', payerAddress: USER_ADDRESS })
        )
        expect(mockSetPaymentDetails).toHaveBeenCalledWith(PAYMENT_RESULT)
    })

    it('records the payment for mixed same-chain spends (used to be skipped → charge rotted PENDING)', async () => {
        mockSendMoney.mockResolvedValue({
            txHash: undefined,
            userOpHash: '0xuserop',
            receipt: { transactionHash: '0xmined', status: 'success' },
            strategy: 'mixed',
            intentId: 'prep-intent-1',
        })

        await confirm()

        await waitFor(() => expect(mockStepperGoTo).toHaveBeenCalledWith('success'))
        // The mined tx hash (not the userOp hash) must reach the validator.
        expect(mockRecordPayment).toHaveBeenCalledWith(
            expect.objectContaining({ chargeId: CHARGE_UUID, txHash: '0xmined' })
        )
        expect(mockPosthogCapture).toHaveBeenCalledWith('withdraw_completed', expect.anything())
    })

    it('still shows success when recordPayment fails after a collateral-routed spend (funds already moved)', async () => {
        mockSendMoney.mockResolvedValue({
            txHash: '0xbetx',
            userOpHash: undefined,
            receipt: null,
            strategy: 'collateral-only',
            intentId: CHARGE_UUID,
        })
        mockRecordPayment.mockRejectedValue(new Error('network blip'))

        await confirm()

        await waitFor(() => expect(mockStepperGoTo).toHaveBeenCalledWith('success'))
        // The failing call MUST have been attempted — pre-fix code never called
        // recordPayment on this path, which is the bug.
        expect(mockRecordPayment).toHaveBeenCalled()
        expect(mockSetPaymentDetails).toHaveBeenCalledWith(null)
        expect(mockCaptureMessage).toHaveBeenCalled()
        // No user-facing failure for a withdrawal that succeeded on-chain.
        expect(mockPosthogCapture).not.toHaveBeenCalledWith('withdraw_failed', expect.anything())
        expect(mockSetWithdrawError).not.toHaveBeenCalledWith(expect.objectContaining({ showError: true }))
    })

    it('still shows success when recordPayment fails after a mixed same-chain spend (tolerance covers mixed too)', async () => {
        mockSendMoney.mockResolvedValue({
            txHash: undefined,
            userOpHash: '0xuserop',
            receipt: { transactionHash: '0xmined', status: 'success' },
            strategy: 'mixed',
            intentId: 'prep-intent-1',
        })
        mockRecordPayment.mockRejectedValue(new Error('network blip'))

        await confirm()

        await waitFor(() => expect(mockStepperGoTo).toHaveBeenCalledWith('success'))
        expect(mockRecordPayment).toHaveBeenCalled()
        expect(mockCaptureMessage).toHaveBeenCalled()
        expect(mockPosthogCapture).not.toHaveBeenCalledWith('withdraw_failed', expect.anything())
    })

    it('skips recordPayment when a mixed spend has no mined receipt (a userOp hash would poison the validator)', async () => {
        mockSendMoney.mockResolvedValue({
            txHash: undefined,
            userOpHash: '0xuserop',
            receipt: null,
            strategy: 'mixed',
            intentId: 'prep-intent-1',
        })

        await confirm()

        await waitFor(() => expect(mockStepperGoTo).toHaveBeenCalledWith('success'))
        expect(mockRecordPayment).not.toHaveBeenCalled()
        expect(mockCaptureMessage).toHaveBeenCalled()
        expect(mockSetPaymentDetails).toHaveBeenCalledWith(null)
        expect(mockPosthogCapture).not.toHaveBeenCalledWith('withdraw_failed', expect.anything())
    })

    it('still records cross-chain mixed spends without a mined receipt (skip guard is same-chain only)', async () => {
        Object.assign(mockCrossChainTransfer, { isXChain: true })
        mockSendTransactions.mockResolvedValue({
            userOpHash: '0xuserop',
            receipt: null,
            strategy: 'mixed',
            intentId: 'prep-intent-3',
        })

        await confirm()

        await waitFor(() => expect(mockStepperGoTo).toHaveBeenCalledWith('success'))
        // Cross-chain keeps recording whatever hash it has (pre-existing
        // behavior): the BE validator's cross-chain branch completes from the
        // source-chain submission and never runs same-chain tx matching, so
        // the mixed-without-receipt skip must not apply here.
        expect(mockRecordPayment).toHaveBeenCalledWith(expect.objectContaining({ txHash: '0xuserop' }))
    })

    it('keeps rethrowing recordPayment failures on cross-chain withdrawals (mixed funding included)', async () => {
        // isDiffToken-only on purpose: same-chain USDC→ETH historically got
        // silently downgraded to a plain transfer (see isCrossChainWithdrawal)
        // — pin that token-boundary-only also routes through sendTransactions
        // and keeps the strict rethrow.
        Object.assign(mockCrossChainTransfer, { isDiffToken: true })
        mockSendTransactions.mockResolvedValue({
            userOpHash: '0xuserop',
            receipt: { transactionHash: '0xmined', status: 'success' },
            strategy: 'mixed',
            intentId: 'prep-intent-2',
        })
        mockRecordPayment.mockRejectedValue(new Error('record failed'))

        await confirm()

        await waitFor(() => expect(mockPosthogCapture).toHaveBeenCalledWith('withdraw_failed', expect.anything()))
        expect(mockSendMoney).not.toHaveBeenCalled()
        expect(mockStepperGoTo).not.toHaveBeenCalledWith('success')
        expect(mockSetWithdrawError).toHaveBeenCalledWith(expect.objectContaining({ showError: true }))
    })

    it('keeps surfacing recordPayment failures on the smart-only path (its only completion trigger)', async () => {
        mockSendMoney.mockResolvedValue({
            txHash: undefined,
            userOpHash: '0xuserop',
            receipt: { transactionHash: '0xmined', status: 'success' },
            strategy: 'smart-only',
            intentId: undefined,
        })
        mockRecordPayment.mockRejectedValue(new Error('record failed'))

        await confirm()

        await waitFor(() => expect(mockPosthogCapture).toHaveBeenCalledWith('withdraw_failed', expect.anything()))
        expect(mockStepperGoTo).not.toHaveBeenCalledWith('success')
        expect(mockSetWithdrawError).toHaveBeenCalledWith(expect.objectContaining({ showError: true }))
    })
})

describe('crypto withdraw retry — record-only replay (TASK-19581 double-spend)', () => {
    // The prod incident: recordPayment times out AFTER the on-chain transfer
    // broadcast; the user lands on Retry, and pre-fix Retry re-ran the whole
    // flow — issuing a SECOND on-chain transfer for the same charge.
    it('retry after a recordPayment failure never re-broadcasts — it replays only the record with the same hash', async () => {
        mockSendMoney.mockResolvedValue({
            txHash: undefined,
            userOpHash: '0xuserop',
            receipt: { transactionHash: '0xmined', status: 'success' },
            strategy: 'smart-only',
            intentId: undefined,
        })
        mockRecordPayment.mockRejectedValueOnce(new Error('Request timed out after 30000ms'))

        render(<WithdrawCryptoPage />)
        fireEvent.click(screen.getByTestId('confirm-withdraw'))
        await waitFor(() => expect(mockPosthogCapture).toHaveBeenCalledWith('withdraw_failed', expect.anything()))
        expect(mockSendMoney).toHaveBeenCalledTimes(1)

        fireEvent.click(screen.getByTestId('confirm-withdraw'))
        await waitFor(() => expect(mockStepperGoTo).toHaveBeenCalledWith('success'))

        // The on-chain leg ran exactly once across both attempts.
        expect(mockSendMoney).toHaveBeenCalledTimes(1)
        expect(mockSendTransactions).not.toHaveBeenCalled()
        // The record ran twice, both times with the ORIGINAL mined hash.
        expect(mockRecordPayment).toHaveBeenCalledTimes(2)
        expect(mockRecordPayment).toHaveBeenLastCalledWith(expect.objectContaining({ txHash: '0xmined' }))
    })

    it('a failure BEFORE any tx identifier exists retries with a fresh broadcast (nothing was spent)', async () => {
        mockSendMoney.mockRejectedValueOnce(new Error('user rejected signature')).mockResolvedValueOnce({
            txHash: '0xbetx',
            userOpHash: undefined,
            receipt: null,
            strategy: 'collateral-only',
            intentId: CHARGE_UUID,
        })

        render(<WithdrawCryptoPage />)
        fireEvent.click(screen.getByTestId('confirm-withdraw'))
        await waitFor(() => expect(mockPosthogCapture).toHaveBeenCalledWith('withdraw_failed', expect.anything()))

        fireEvent.click(screen.getByTestId('confirm-withdraw'))
        await waitFor(() => expect(mockStepperGoTo).toHaveBeenCalledWith('success'))

        // No spend happened on attempt 1, so attempt 2 legitimately broadcasts.
        expect(mockSendMoney).toHaveBeenCalledTimes(2)
    })
})

describe('crypto withdraw — success step demands execution proof (Chip review PR #2917)', () => {
    afterEach(() => {
        mockWithdrawFlow.transactionHash = null
    })

    const lastGuards = () => mockStepperOptions.mock.calls.at(-1)?.[0]?.guards as Record<string, { ok: boolean }>

    test('with prepared charge data but no broadcast tx, the success guard refuses (?step=success tampering)', () => {
        render(<WithdrawCryptoPage />)
        expect(lastGuards().review.ok).toBe(true)
        expect(lastGuards().success.ok).toBe(false)
    })

    test('after execution the success guard admits the step', () => {
        mockWithdrawFlow.transactionHash = '0xabc'
        render(<WithdrawCryptoPage />)
        expect(lastGuards().success.ok).toBe(true)
    })
})

describe('crypto withdraw — unmount keeps the flow selection (Chip review PR #2917)', () => {
    test('unmount clears transient state only — never resetWithdrawFlow', () => {
        // Back from the recipient screen is an intra-/withdraw transition:
        // the root amount guard needs selectedMethod to survive, or back
        // bounces to method selection instead of the amount step. The page
        // must clear its transient state (charge, route, recipient) without
        // the blanket reset.
        const { unmount } = render(<WithdrawCryptoPage />)
        unmount()

        expect(mockWithdrawFlow.resetWithdrawFlow).not.toHaveBeenCalled()
        expect(mockWithdrawFlow.setChargeDetails).toHaveBeenCalledWith(null)
        expect(mockWithdrawFlow.setWithdrawData).toHaveBeenCalledWith(null)
        expect(mockSetTransactionHash).toHaveBeenCalledWith(null)
        expect(mockSetPaymentDetails).toHaveBeenCalledWith(null)
        expect(mockSetRecipient).toHaveBeenCalledWith({ address: '', name: '' })
        expect(mockSetIsValidRecipient).toHaveBeenCalledWith(false)
    })
})

describe('crypto withdraw — URL amount validation (Chip review round 4)', () => {
    // the setup path: recipient screen → Review click → request/charge creation
    const clickReview = () => {
        mockStepper.step = 'recipient'
        const view = render(<WithdrawCryptoPage />)
        fireEvent.click(screen.getByTestId('review-cta'))
        return view
    }

    const { requestsApi } = jest.requireMock('@/services/requests') as {
        requestsApi: { create: jest.Mock }
    }
    const { chargesApi } = jest.requireMock('@/services/charges') as {
        chargesApi: { create: jest.Mock; get: jest.Mock; cancel: jest.Mock }
    }

    const armHappyPersistence = () => {
        requestsApi.create.mockResolvedValue({ uuid: 'req-1' })
        chargesApi.create.mockResolvedValue({ data: { id: CHARGE_UUID } })
        chargesApi.get.mockResolvedValue(chargeDetails)
    }

    test.each([['0'], ['abc'], ['-5']])('?amount=%s persists no request and no charge', async (tampered) => {
        mockUrlAmount = tampered
        clickReview()

        // error surfaced, nothing persisted
        await waitFor(() => expect(mockSetPaymentError).toHaveBeenCalled())
        expect(requestsApi.create).not.toHaveBeenCalled()
        expect(chargesApi.create).not.toHaveBeenCalled()
    })

    test('an over-balance ?amount= persists no request and no charge', async () => {
        mockUrlAmount = '150'
        mockIsAmountWithinBalance.mockImplementation(() => false)
        clickReview()

        await waitFor(() => expect(mockSetPaymentError).toHaveBeenCalled())
        expect(requestsApi.create).not.toHaveBeenCalled()
        expect(chargesApi.create).not.toHaveBeenCalled()
    })

    test('a valid amount persists the request/charge with the normalized value', async () => {
        armHappyPersistence()
        clickReview()

        await waitFor(() => expect(chargesApi.get).toHaveBeenCalledWith(CHARGE_UUID))
        // a new review invalidates the previous attempt's execution proof —
        // otherwise ?step=success re-renders the old success screen (Chip round 7)
        expect(mockSetTransactionHash).toHaveBeenCalledWith(null)
        expect(requestsApi.create).not.toHaveBeenCalled()
        expect(chargesApi.create).toHaveBeenCalledWith(
            expect.objectContaining({ local_price: { amount: '50', currency: 'USD' } })
        )
    })

    test('a post-review amount edit cancels the old draft and cannot broadcast it', async () => {
        armHappyPersistence()
        mockSendMoney.mockResolvedValue({
            txHash: '0xbetx',
            userOpHash: undefined,
            receipt: null,
            strategy: 'collateral-only',
        })

        const view = clickReview()
        await waitFor(() => expect(chargesApi.get).toHaveBeenCalled())

        // tamper the URL after the records exist, then confirm
        mockUrlAmount = '999999'
        mockStepper.step = 'review'
        view.rerender(<WithdrawCryptoPage />)
        fireEvent.click(screen.getByTestId('confirm-withdraw'))

        await waitFor(() => expect(chargesApi.cancel).toHaveBeenCalledWith(CHARGE_UUID))
        expect(mockSendMoney).not.toHaveBeenCalled()
    })

    test('a tampered over-balance amount at confirm never reaches sendMoney', async () => {
        // no setup ran in this mount (no pin) — the URL amount is all there is
        mockUrlAmount = '150'
        mockIsAmountWithinBalance.mockImplementation(() => false)
        await confirm()

        await waitFor(() => expect(mockSetPaymentError).toHaveBeenCalled())
        expect(mockSendMoney).not.toHaveBeenCalled()
        expect(mockSendTransactions).not.toHaveBeenCalled()
    })

    test('a malformed amount at confirm never reaches sendMoney', async () => {
        mockUrlAmount = 'abc'
        await confirm()

        await waitFor(() => expect(mockSetPaymentError).toHaveBeenCalled())
        expect(mockSendMoney).not.toHaveBeenCalled()
    })
})

// ============================================================
// The spend is frozen with the charge (max withdrawal / TASK-21899)
// ============================================================
describe('crypto withdraw — the spend is frozen with the charge', () => {
    const { requestsApi } = jest.requireMock('@/services/requests') as {
        requestsApi: { create: jest.Mock }
    }
    const { chargesApi } = jest.requireMock('@/services/charges') as {
        chargesApi: { create: jest.Mock; get: jest.Mock; cancel: jest.Mock }
    }
    const { parseUnits } = jest.requireActual('viem') as { parseUnits: (v: string, d: number) => bigint }

    const armHappyPersistence = () => {
        requestsApi.create.mockResolvedValue({ uuid: 'req-1' })
        chargesApi.create.mockResolvedValue({ data: { id: CHARGE_UUID } })
        chargesApi.get.mockResolvedValue(chargeDetails)
    }

    const SENT = {
        txHash: '0xsent',
        userOpHash: undefined,
        receipt: { transactionHash: '0xsent', status: 'success' },
        strategy: 'smart-only',
        intentId: undefined,
    }

    // drive the real setup path so the charge pins the RESOLVED amount
    const setupThenShowConfirm = async () => {
        mockStepper.step = 'recipient'
        const view = render(<WithdrawCryptoPage />)
        fireEvent.click(screen.getByTestId('review-cta'))
        await waitFor(() => expect(chargesApi.get).toHaveBeenCalled())
        mockStepper.step = 'review'
        view.rerender(<WithdrawCryptoPage />)
        return view
    }

    // The feature exists to drain the dust. Nothing asserted the amount that
    // actually leaves the wallet, so wiring sendMoney back to the displayed
    // 2-decimal amount would keep the suite green while the remainder stayed
    // stranded — displaying as $0.00 and never withdrawable.
    it('a max withdrawal sends the sub-cent remainder, not the displayed cents', async () => {
        mockWithdrawFlow.isMaxWithdrawal = true
        mockUrlAmount = '50'
        mockWalletState.spendableBalance = 50_006123n
        armHappyPersistence()
        mockSendMoney.mockResolvedValue(SENT)

        const view = await setupThenShowConfirm()
        // the request/charge rows are created from the full-precision balance
        expect(chargesApi.create).toHaveBeenCalledWith(
            expect.objectContaining({ local_price: { amount: '50.006123', currency: 'USD' } })
        )

        fireEvent.click(screen.getByTestId('confirm-withdraw'))
        await waitFor(() => expect(mockSendMoney).toHaveBeenCalled())
        expect(mockSendMoney).toHaveBeenCalledWith(RECIPIENT, '50.006123', expect.anything())
        view.unmount()
    })

    // The charge records one number and the API validator settles against it.
    // Deriving the spend live would let the balance move underneath while both
    // values still floored to the same displayed cents — the wallet would
    // underpay its own charge.
    it('a balance drop after the charge is prepared does not change what is sent', async () => {
        mockWithdrawFlow.isMaxWithdrawal = true
        mockUrlAmount = '10.12'
        mockWalletState.spendableBalance = 10_126123n
        armHappyPersistence()
        // real balance math so the pre-broadcast gate sees the drop
        mockIsAmountWithinBalance.mockImplementation(
            (amt: unknown, bal: unknown) => parseUnits(String(amt), 6) <= (bal as bigint)
        )
        mockSendMoney.mockResolvedValue(SENT)

        const view = await setupThenShowConfirm()
        expect(chargesApi.create).toHaveBeenCalledWith(
            expect.objectContaining({ local_price: { amount: '10.126123', currency: 'USD' } })
        )

        // the drifted 10.121111 still floors to the on-screen 10.12, but the
        // frozen 10.126123 no longer fits — the gate must refuse, and above all
        // the drifted value must never be what gets signed
        mockWalletState.spendableBalance = 10_121111n
        view.rerender(<WithdrawCryptoPage />)
        fireEvent.click(screen.getByTestId('confirm-withdraw'))
        await waitFor(() => expect(mockSetPaymentError).toHaveBeenCalled())
        expect(mockSendMoney).not.toHaveBeenCalled()
        expect(mockSendTransactions).not.toHaveBeenCalled()
    })

    it('does not re-quote a prepared max withdrawal when the balance changes during broadcast', async () => {
        mockWithdrawFlow.isMaxWithdrawal = true
        mockUrlAmount = '10.12'
        mockWalletState.spendableBalance = 10_126123n
        armHappyPersistence()
        let finishSpend!: (value: typeof SENT) => void
        mockSendMoney.mockImplementation(
            () =>
                new Promise((resolve) => {
                    finishSpend = resolve
                })
        )
        const view = await setupThenShowConfirm()
        const quotes = mockCrossChainTransfer.calculate.mock.calls.length
        fireEvent.click(screen.getByTestId('confirm-withdraw'))
        await waitFor(() => expect(mockSendMoney).toHaveBeenCalled())
        mockWalletState.spendableBalance = 0n
        view.rerender(<WithdrawCryptoPage />)
        expect(mockCrossChainTransfer.calculate).toHaveBeenCalledTimes(quotes)
        await act(async () => finishSpend(SENT))
        expect(mockCrossChainTransfer.calculate).toHaveBeenCalledTimes(quotes)
    })

    it('a balance rise after the charge is prepared does not enlarge what is sent', async () => {
        mockWithdrawFlow.isMaxWithdrawal = true
        mockUrlAmount = '10.12'
        mockWalletState.spendableBalance = 10_126123n
        armHappyPersistence()
        mockIsAmountWithinBalance.mockImplementation(
            (amt: unknown, bal: unknown) => parseUnits(String(amt), 6) <= (bal as bigint)
        )
        mockSendMoney.mockResolvedValue(SENT)

        const view = await setupThenShowConfirm()

        mockWalletState.spendableBalance = 10_129999n
        view.rerender(<WithdrawCryptoPage />)
        fireEvent.click(screen.getByTestId('confirm-withdraw'))
        await waitFor(() => expect(mockSendMoney).toHaveBeenCalled())
        expect(mockSendMoney).toHaveBeenCalledWith(RECIPIENT, '10.126123', expect.anything())
    })
})

describe('crypto withdraw retry — after a route error (cross-chain cap 429, TASK-22154)', () => {
    const prepareMaxWithdrawal = async () => {
        const { chargesApi } = jest.requireMock('@/services/charges')
        chargesApi.create.mockResolvedValue({ data: { id: CHARGE_UUID } })
        chargesApi.get.mockResolvedValue(chargeDetails)
        mockUrlAmount = '10.12'
        mockWithdrawFlow.isMaxWithdrawal = true
        mockWalletState.spendableBalance = 10_126123n
        mockStepper.step = 'recipient'
        const view = render(<WithdrawCryptoPage />)
        fireEvent.click(screen.getByTestId('review-cta'))
        await waitFor(() => expect(chargesApi.get).toHaveBeenCalled())
        mockStepper.step = 'review'
        view.rerender(<WithdrawCryptoPage />)
        return view
    }
    // The cap answers the SDA provision with 429 while the route is being
    // prepared, so the confirm view renders the error with no transactions
    // built. Retry must recompute the route, not fail on "not prepared".
    it('Retry recomputes the route instead of failing on the transactions the failed route never built', async () => {
        const m = mockCrossChainTransfer as unknown as { transactions: unknown; error: unknown; calculate: jest.Mock }
        const prev = { transactions: m.transactions, error: m.error }
        m.transactions = null
        m.error = 'You reached the limit for withdrawals to other networks. Try again in about 50 minutes.'
        try {
            await prepareMaxWithdrawal()
            await waitFor(() => expect(m.calculate).toHaveBeenCalled())
            const calculateCalls = m.calculate.mock.calls.length
            const errorCalls = mockSetPaymentError.mock.calls.length

            fireEvent.click(screen.getByTestId('confirm-withdraw'))

            await waitFor(() => expect(m.calculate.mock.calls.length).toBe(calculateCalls + 1))
            expect(m.calculate.mock.calls.at(-1)?.[0]).toEqual(
                expect.objectContaining({ source: expect.objectContaining({ tokenAmount: '10.126123' }) })
            )
            expect(mockSendMoney).not.toHaveBeenCalled()
            expect(mockSendTransactions).not.toHaveBeenCalled()
            // Retry only clears errors (null); it never sets "transaction not prepared"
            const afterClick = mockSetPaymentError.mock.calls.slice(errorCalls).map((c) => c[0])
            expect(afterClick.every((v) => v === null)).toBe(true)
        } finally {
            m.transactions = prev.transactions
            m.error = prev.error
        }
    })

    it('quotes the frozen max-withdrawal amount when entering confirm', async () => {
        await prepareMaxWithdrawal()
        await waitFor(() => expect(mockCrossChainTransfer.calculate).toHaveBeenCalled())
        expect(mockCrossChainTransfer.calculate.mock.calls[0][0]).toEqual(
            expect.objectContaining({ source: expect.objectContaining({ tokenAmount: '10.126123' }) })
        )
    })

    it('Retry does nothing while a recalculation is already in flight (a double tap must not provision twice)', async () => {
        const m = mockCrossChainTransfer as unknown as {
            transactions: unknown
            error: unknown
            isCalculating: boolean
            calculate: jest.Mock
        }
        const prev = { transactions: m.transactions, error: m.error, isCalculating: m.isCalculating }
        m.transactions = null
        m.error = 'You reached the limit for withdrawals to other networks. Try again in about 50 minutes.'
        m.isCalculating = true
        try {
            render(<WithdrawCryptoPage />)
            await waitFor(() => expect(m.calculate).toHaveBeenCalled())
            const calculateCalls = m.calculate.mock.calls.length
            const errorCalls = mockSetPaymentError.mock.calls.length

            fireEvent.click(screen.getByTestId('confirm-withdraw'))
            fireEvent.click(screen.getByTestId('confirm-withdraw'))
            await new Promise((r) => setTimeout(r, 50))

            expect(m.calculate.mock.calls.length).toBe(calculateCalls)
            expect(mockSendMoney).not.toHaveBeenCalled()
            const afterClick = mockSetPaymentError.mock.calls.slice(errorCalls).map((c) => c[0])
            expect(afterClick.every((v) => v === null)).toBe(true)
        } finally {
            m.transactions = prev.transactions
            m.error = prev.error
            m.isCalculating = prev.isCalculating
        }
    })
})

describe('unpaid withdrawal draft cleanup', () => {
    beforeEach(() => {
        mockStepper.step = 'recipient'
        jest.mocked(chargesApi.create).mockResolvedValue({ data: { id: CHARGE_UUID } } as never)
        jest.mocked(chargesApi.get).mockResolvedValue(chargeDetails as never)
        jest.mocked(chargesApi.cancel).mockResolvedValue(undefined)
    })

    it('cancels a created charge when its detail fetch fails', async () => {
        jest.mocked(chargesApi.get).mockRejectedValueOnce(new Error('detail fetch failed'))
        render(<WithdrawCryptoPage />)
        fireEvent.click(screen.getByTestId('review-cta'))
        await waitFor(() => expect(chargesApi.cancel).toHaveBeenCalledWith(CHARGE_UUID))
        expect(mockSendMoney).not.toHaveBeenCalled()
    })

    it('cancels the unpaid charge on unmount', async () => {
        const view = render(<WithdrawCryptoPage />)
        fireEvent.click(screen.getByTestId('review-cta'))
        await waitFor(() => expect(chargesApi.get).toHaveBeenCalled())
        view.unmount()
        await waitFor(() => expect(chargesApi.cancel).toHaveBeenCalledWith(CHARGE_UUID))
    })

    it('cancels a charge whose create response arrives after unmount', async () => {
        let resolveCreate!: (value: never) => void
        jest.mocked(chargesApi.create).mockImplementationOnce(
            () =>
                new Promise((resolve) => {
                    resolveCreate = resolve
                })
        )
        const view = render(<WithdrawCryptoPage />)
        fireEvent.click(screen.getByTestId('review-cta'))
        view.unmount()
        resolveCreate({ data: { id: CHARGE_UUID } } as never)
        await waitFor(() => expect(chargesApi.cancel).toHaveBeenCalledWith(CHARGE_UUID))
        expect(chargesApi.get).not.toHaveBeenCalled()
    })

    it('creates only one charge for two Review clicks', async () => {
        render(<WithdrawCryptoPage />)
        fireEvent.click(screen.getByTestId('review-cta'))
        fireEvent.click(screen.getByTestId('review-cta'))
        await waitFor(() => expect(chargesApi.get).toHaveBeenCalled())
        expect(chargesApi.create).toHaveBeenCalledTimes(1)
    })

    it('cancels on Back and refuses a stale Confirm handler', async () => {
        const view = render(<WithdrawCryptoPage />)
        fireEvent.click(screen.getByTestId('review-cta'))
        await waitFor(() => expect(chargesApi.get).toHaveBeenCalled())
        mockStepper.step = 'review'
        view.rerender(<WithdrawCryptoPage />)
        fireEvent.click(screen.getByTestId('back-review'))
        fireEvent.click(screen.getByTestId('confirm-withdraw'))
        expect(chargesApi.cancel).toHaveBeenCalledTimes(1)
        expect(mockSendMoney).not.toHaveBeenCalled()
    })

    it('allows a new Review after a signing error without cancelling the old charge', async () => {
        mockSendMoney.mockRejectedValueOnce(new Error('signing rejected'))
        const view = render(<WithdrawCryptoPage />)
        fireEvent.click(screen.getByTestId('review-cta'))
        await waitFor(() => expect(chargesApi.get).toHaveBeenCalled())
        mockStepper.step = 'review'
        view.rerender(<WithdrawCryptoPage />)
        fireEvent.click(screen.getByTestId('confirm-withdraw'))
        await waitFor(() => expect(mockSetPaymentError).toHaveBeenCalledWith('signing rejected'))
        fireEvent.click(screen.getByTestId('back-review'))
        mockStepper.step = 'recipient'
        view.rerender(<WithdrawCryptoPage />)
        fireEvent.click(screen.getByTestId('review-cta'))
        await waitFor(() => expect(chargesApi.create).toHaveBeenCalledTimes(2))
        expect(chargesApi.cancel).not.toHaveBeenCalled()
    })

    it('cancels and clears the charge when the compatibility modal closes', async () => {
        mockWithdrawFlow.showCompatibilityModal = true
        const view = render(<WithdrawCryptoPage />)
        fireEvent.click(screen.getByTestId('review-cta'))
        await waitFor(() => expect(chargesApi.get).toHaveBeenCalled())
        fireEvent.click(screen.getByTestId('modal-close'))
        expect(chargesApi.cancel).toHaveBeenCalledWith(CHARGE_UUID)
        expect(mockWithdrawFlow.setChargeDetails).toHaveBeenCalledWith(null)
        view.unmount()
        mockWithdrawFlow.showCompatibilityModal = false
    })

    it('broadcasts once for two Confirm clicks while the first send is pending', async () => {
        mockSendMoney.mockImplementationOnce(() => new Promise(() => {}))
        const view = render(<WithdrawCryptoPage />)
        fireEvent.click(screen.getByTestId('review-cta'))
        await waitFor(() => expect(chargesApi.get).toHaveBeenCalled())
        mockStepper.step = 'review'
        view.rerender(<WithdrawCryptoPage />)
        fireEvent.click(screen.getByTestId('confirm-withdraw'))
        fireEvent.click(screen.getByTestId('confirm-withdraw'))
        await waitFor(() => expect(mockSendMoney).toHaveBeenCalledTimes(1))
        view.unmount()
        expect(chargesApi.cancel).not.toHaveBeenCalled()
    })

    it('never cancels after signing starts, including an ambiguous timeout', async () => {
        mockSendMoney.mockRejectedValueOnce(new Error('network timeout'))
        const view = render(<WithdrawCryptoPage />)
        fireEvent.click(screen.getByTestId('review-cta'))
        await waitFor(() => expect(chargesApi.get).toHaveBeenCalled())
        mockStepper.step = 'review'
        view.rerender(<WithdrawCryptoPage />)
        fireEvent.click(screen.getByTestId('confirm-withdraw'))
        await waitFor(() => expect(mockSendMoney).toHaveBeenCalledTimes(1))
        view.unmount()
        expect(chargesApi.cancel).not.toHaveBeenCalled()
    })
})
