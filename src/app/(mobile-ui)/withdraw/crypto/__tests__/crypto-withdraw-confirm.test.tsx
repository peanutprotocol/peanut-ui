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
import { render as rtlRender, screen, fireEvent, waitFor } from '@testing-library/react'
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

// NOT stubbed: `isAmountWithinBalance` is the pre-sign affordability gate, and
// a stub that always says "affordable" cannot fail the way the real comparison
// does. The fixtures below fund the wallet well above the amount, so the
// existing cases are unaffected; the balance-gate suite drives it to the edge.
jest.mock('@/utils/balance.utils', () => jest.requireActual('@/utils/balance.utils'))

jest.mock('@/utils/withdraw.utils', () => ({
    isBelowRhinoMinDeposit: () => false,
    // real behaviour, covered by src/utils/__tests__/withdraw.utils.test.ts —
    // these suites drive the non-max path, where it returns the amount as-is
    resolveWithdrawAmount: jest.requireActual('@/utils/withdraw.utils').resolveWithdrawAmount,
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
    chargesApi: { create: jest.fn(), get: jest.fn() },
}))

jest.mock('@/services/requests', () => ({
    requestsApi: { create: jest.fn() },
}))

// ---------- view mocks ----------

jest.mock('@/components/Withdraw/views/Confirm.withdraw.view', () => ({
    __esModule: true,
    default: (props: { onConfirm: () => void; insufficientBalance?: boolean; error?: string | null }) =>
        // Mirrors the real view: the normal CTA honours insufficientBalance, but
        // the error-state Retry renders with disabled={false}. Do NOT "fix" that
        // here — a mock that disables Retry too would hide the gap between the
        // gate and the retry path.
        props.error ? (
            <button data-testid="confirm-withdraw" onClick={props.onConfirm}>
                Retry
            </button>
        ) : (
            <button data-testid="confirm-withdraw" onClick={props.onConfirm} disabled={props.insufficientBalance}>
                Confirm
            </button>
        ),
}))

jest.mock('@/components/Withdraw/views/Initial.withdraw.view', () => ({
    __esModule: true,
    default: (props: { onReview: (data: unknown) => void }) => (
        <button data-testid="initial-view" onClick={() => props.onReview(withdrawData)}>
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
    default: () => null,
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

const mockSetCurrentView = jest.fn()
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

const mockSetPreparedAmount = jest.fn()
const mockWithdrawFlow = {
    recipient: { name: ' Alice.eth ' },
    amountToWithdraw: '50',
    isMaxWithdrawal: false,
    setIsMaxWithdrawal: jest.fn(),
    preparedAmount: null as string | null,
    setPreparedAmount: mockSetPreparedAmount,
    usdAmount: '50',
    setAmountToWithdraw: jest.fn(),
    currentView: 'CONFIRM',
    setCurrentView: mockSetCurrentView,
    withdrawData,
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

jest.mock('@/context/WithdrawFlowContext', () => ({
    useWithdrawFlow: () => mockWithdrawFlow,
}))

const mockSendMoney = jest.fn()
const mockSendTransactions = jest.fn()
/** Mutable so the balance-gate suite can drive the comparison to the edge. */
const mockWallet = { spendableBalance: 100n * 10n ** 6n }
jest.mock('@/hooks/wallet/useWallet', () => ({
    useWallet: () => ({
        isConnected: true,
        address: USER_ADDRESS,
        sendMoney: mockSendMoney,
        sendTransactions: mockSendTransactions,
        spendableBalance: mockWallet.spendableBalance,
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
    jest.clearAllMocks()
    mockRecordPayment.mockResolvedValue(PAYMENT_RESULT)
    Object.assign(mockCrossChainTransfer, { isXChain: false, isDiffToken: false, quoteExpiresAt: null })
})

describe('crypto withdraw preparation', () => {
    it('creates a standalone WITHDRAW charge without an existing request link', async () => {
        mockWithdrawFlow.currentView = 'INITIAL'
        jest.mocked(chargesApi.create).mockResolvedValue({ data: { id: CHARGE_UUID } } as never)
        jest.mocked(chargesApi.get).mockResolvedValue(chargeDetails as never)
        try {
            render(<WithdrawCryptoPage />)
            fireEvent.click(screen.getByTestId('initial-view'))
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
            expect(mockSetPreparedAmount).toHaveBeenLastCalledWith('50')
            expect(mockWithdrawFlow.setChargeDetails).toHaveBeenLastCalledWith(chargeDetails)
        } finally {
            mockWithdrawFlow.currentView = 'CONFIRM'
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
        expect(mockSetCurrentView).not.toHaveBeenCalledWith('STATUS')
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
        // Entering the confirm view quotes once; the tap must not quote again.
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

        await waitFor(() => expect(mockSetCurrentView).toHaveBeenCalledWith('STATUS'))
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

        await waitFor(() => expect(mockSetCurrentView).toHaveBeenCalledWith('STATUS'))
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

        await waitFor(() => expect(mockSetCurrentView).toHaveBeenCalledWith('STATUS'))
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

        await waitFor(() => expect(mockSetCurrentView).toHaveBeenCalledWith('STATUS'))
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

        await waitFor(() => expect(mockSetCurrentView).toHaveBeenCalledWith('STATUS'))
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

        await waitFor(() => expect(mockSetCurrentView).toHaveBeenCalledWith('STATUS'))
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
        expect(mockSetCurrentView).not.toHaveBeenCalledWith('STATUS')
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
        expect(mockSetCurrentView).not.toHaveBeenCalledWith('STATUS')
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
        await waitFor(() => expect(mockSetCurrentView).toHaveBeenCalledWith('STATUS'))

        // The on-chain leg ran exactly once across both attempts.
        expect(mockSendMoney).toHaveBeenCalledTimes(1)
        expect(mockSendTransactions).not.toHaveBeenCalled()
        // The record ran twice, both times with the ORIGINAL mined hash.
        expect(mockRecordPayment).toHaveBeenCalledTimes(2)
        expect(mockRecordPayment).toHaveBeenLastCalledWith(expect.objectContaining({ txHash: '0xmined' }))
    })

    // The two guards meet here: the quote ages out WHILE a record-only retry is
    // pending. Re-quoting would strand the spend that already happened, so the
    // alreadySpent exemption has to win over the expiry check — the case the
    // expiry tests never covered, because none of them had an executed spend.
    it('an aged quote does not re-quote a retry whose funds already moved', async () => {
        jest.useFakeTimers({ now: new Date('2026-09-01T12:00:00Z') })
        try {
            Object.assign(mockCrossChainTransfer, {
                isXChain: true,
                quoteExpiresAt: new Date(Date.now() + 60_000).toISOString(),
            })
            mockSendTransactions.mockResolvedValue({
                userOpHash: '0xuserop',
                receipt: { transactionHash: '0xmined', status: 'success' },
                strategy: 'mixed',
                intentId: 'prep-intent-expiry',
            })
            mockRecordPayment.mockRejectedValueOnce(new Error('Request timed out after 30000ms'))

            render(<WithdrawCryptoPage />)
            fireEvent.click(screen.getByTestId('confirm-withdraw'))
            await waitFor(() => expect(mockPosthogCapture).toHaveBeenCalledWith('withdraw_failed', expect.anything()))
            expect(mockSendTransactions).toHaveBeenCalledTimes(1)
            const quotesBeforeRetry = mockCrossChainTransfer.calculate.mock.calls.length

            // The quote is now stale — but the money is already gone.
            jest.setSystemTime(Date.now() + 120_000)
            fireEvent.click(screen.getByTestId('confirm-withdraw'))
            await waitFor(() => expect(mockSetCurrentView).toHaveBeenCalledWith('STATUS'))

            expect(mockCrossChainTransfer.calculate).toHaveBeenCalledTimes(quotesBeforeRetry)
            expect(mockSendTransactions).toHaveBeenCalledTimes(1)
            expect(mockSendMoney).not.toHaveBeenCalled()
            expect(mockRecordPayment).toHaveBeenLastCalledWith(expect.objectContaining({ txHash: '0xmined' }))
        } finally {
            jest.useRealTimers()
            Object.assign(mockCrossChainTransfer, { isXChain: false, quoteExpiresAt: null })
        }
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
        await waitFor(() => expect(mockSetCurrentView).toHaveBeenCalledWith('STATUS'))

        // No spend happened on attempt 1, so attempt 2 legitimately broadcasts.
        expect(mockSendMoney).toHaveBeenCalledTimes(2)
    })
})

describe('crypto withdraw confirm — pre-sign balance gate (real balance math)', () => {
    // The gate now covers the same-chain path too — the highest-volume route,
    // and the one "use full balance" is built for. Nothing stubs the comparison
    // in this suite, so these run the real bigint math.
    const BALANCE = 50n * 10n ** 6n

    afterEach(() => {
        mockWallet.spendableBalance = 100n * 10n ** 6n
        Object.assign(mockWithdrawFlow, { isMaxWithdrawal: false })
        Object.assign(mockCrossChainTransfer, { payAmount: '50' })
    })

    it('a full-balance same-chain withdraw at exact equality keeps the CTA enabled', () => {
        mockWallet.spendableBalance = BALANCE
        Object.assign(mockWithdrawFlow, { isMaxWithdrawal: true })
        // What the CHARGE records: usdValue / token.price, and a USDC price of
        // 0.9999 is routine from a feed. The kernel still sends effectiveAmount,
        // so gating on this number would refuse a withdrawal that fits.
        Object.assign(mockCrossChainTransfer, { payAmount: '50.005001' })

        render(<WithdrawCryptoPage />)

        expect(screen.getByTestId('confirm-withdraw')).toBeEnabled()
    })

    it('one base unit short disables the CTA', () => {
        mockWallet.spendableBalance = BALANCE - 1n
        Object.assign(mockWithdrawFlow, { isMaxWithdrawal: true })

        render(<WithdrawCryptoPage />)

        expect(screen.getByTestId('confirm-withdraw')).toBeDisabled()
    })

    it('cross-chain still gates on the quote pay side, which is what the kernel sends', () => {
        mockWallet.spendableBalance = BALANCE
        Object.assign(mockCrossChainTransfer, { isXChain: true, payAmount: '50.01' })
        try {
            render(<WithdrawCryptoPage />)
            expect(screen.getByTestId('confirm-withdraw')).toBeDisabled()
        } finally {
            Object.assign(mockCrossChainTransfer, { isXChain: false })
        }
    })
})

describe('crypto withdraw — the spend is frozen with the charge', () => {
    afterEach(() => {
        mockWallet.spendableBalance = 100n * 10n ** 6n
        Object.assign(mockWithdrawFlow, { amountToWithdraw: '50', isMaxWithdrawal: false, preparedAmount: null })
    })

    // The feature exists to drain the dust. Nothing asserted the amount that
    // actually leaves the wallet, so reverting page.tsx's sendMoney argument to
    // `amountToWithdraw` left the suite green while the remainder stayed
    // stranded — displaying as $0.00 and never withdrawable.
    it('a max withdrawal sends the sub-cent remainder, not the displayed cents', async () => {
        Object.assign(mockWithdrawFlow, { isMaxWithdrawal: true, preparedAmount: '50.006123' })
        mockSendMoney.mockResolvedValue({
            txHash: '0xsent',
            userOpHash: undefined,
            receipt: { transactionHash: '0xsent', status: 'success' },
            strategy: 'smart-only',
            intentId: undefined,
        })

        render(<WithdrawCryptoPage />)
        fireEvent.click(screen.getByTestId('confirm-withdraw'))

        await waitFor(() => expect(mockSendMoney).toHaveBeenCalled())
        expect(mockSendMoney).toHaveBeenCalledWith(RECIPIENT, '50.006123', expect.anything())
    })

    // The charge records one number and the API validator settles against it.
    // Deriving the spend live let the balance move underneath while both values
    // still floored to the displayed cents, so the wallet would underpay its
    // own charge.
    it('a balance drop after the charge is prepared does not change what is sent', async () => {
        // The displayed cents (10.12) are what the old resolver compared against,
        // so a drop to 10.121111 still "matched" and was silently adopted — an
        // underpayment of the 10.126123 charge the validator settles against.
        Object.assign(mockWithdrawFlow, {
            amountToWithdraw: '10.12',
            isMaxWithdrawal: true,
            preparedAmount: '10.126123',
        })
        mockWallet.spendableBalance = 10_121111n
        mockSendMoney.mockResolvedValue({
            txHash: '0xsent',
            userOpHash: undefined,
            receipt: { transactionHash: '0xsent', status: 'success' },
            strategy: 'smart-only',
            intentId: undefined,
        })

        render(<WithdrawCryptoPage />)
        fireEvent.click(screen.getByTestId('confirm-withdraw'))

        // The gate refuses it — the frozen spend no longer fits the balance — and
        // above all the drifted 10.121111 is never what gets signed.
        expect(screen.getByTestId('confirm-withdraw')).toBeDisabled()
        expect(mockSendMoney).not.toHaveBeenCalledWith(RECIPIENT, '10.121111', expect.anything())
        expect(mockSendMoney).not.toHaveBeenCalled()
    })

    it('a balance rise after the charge is prepared does not enlarge what is sent', async () => {
        Object.assign(mockWithdrawFlow, {
            amountToWithdraw: '10.12',
            isMaxWithdrawal: true,
            preparedAmount: '10.126123',
        })
        mockWallet.spendableBalance = 10_129999n
        mockSendMoney.mockResolvedValue({
            txHash: '0xsent',
            userOpHash: undefined,
            receipt: { transactionHash: '0xsent', status: 'success' },
            strategy: 'smart-only',
            intentId: undefined,
        })

        render(<WithdrawCryptoPage />)
        fireEvent.click(screen.getByTestId('confirm-withdraw'))

        await waitFor(() => expect(mockSendMoney).toHaveBeenCalled())
        expect(mockSendMoney).toHaveBeenCalledWith(RECIPIENT, '10.126123', expect.anything())
    })
})

describe('crypto withdraw retry — after a route error (cross-chain cap 429, TASK-22154)', () => {
    // The cap answers the SDA provision with 429 while the route is being
    // prepared, so the confirm view renders the error with no transactions
    // built. Retry must recompute the route, not fail on "not prepared".
    it('Retry recomputes the route instead of failing on the transactions the failed route never built', async () => {
        const m = mockCrossChainTransfer as unknown as { transactions: unknown; error: unknown; calculate: jest.Mock }
        const prev = { transactions: m.transactions, error: m.error }
        const prevFlow = {
            amountToWithdraw: mockWithdrawFlow.amountToWithdraw,
            isMaxWithdrawal: mockWithdrawFlow.isMaxWithdrawal,
            preparedAmount: mockWithdrawFlow.preparedAmount,
        }
        m.transactions = null
        m.error = 'You reached the limit for withdrawals to other networks. Try again in about 50 minutes.'
        Object.assign(mockWithdrawFlow, {
            amountToWithdraw: '10.12',
            isMaxWithdrawal: true,
            preparedAmount: '10.126123',
        })
        try {
            render(<WithdrawCryptoPage />)
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
            Object.assign(mockWithdrawFlow, prevFlow)
        }
    })

    it('quotes the frozen max-withdrawal amount when entering confirm', async () => {
        Object.assign(mockWithdrawFlow, {
            amountToWithdraw: '10.12',
            isMaxWithdrawal: true,
            preparedAmount: '10.126123',
        })

        try {
            render(<WithdrawCryptoPage />)

            await waitFor(() => expect(mockCrossChainTransfer.calculate).toHaveBeenCalled())
            expect(mockCrossChainTransfer.calculate.mock.calls[0][0]).toEqual(
                expect.objectContaining({ source: expect.objectContaining({ tokenAmount: '10.126123' }) })
            )
        } finally {
            Object.assign(mockWithdrawFlow, {
                amountToWithdraw: '50',
                isMaxWithdrawal: false,
                preparedAmount: null,
            })
        }
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
