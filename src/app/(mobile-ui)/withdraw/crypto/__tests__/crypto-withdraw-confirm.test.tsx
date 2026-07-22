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
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

// ---------- module-level mocks ----------

jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn(), prefetch: jest.fn() }),
    useSearchParams: () => ({ get: () => null }),
    usePathname: () => '/withdraw/crypto',
}))

const mockCaptureMessage = jest.fn()
jest.mock('@sentry/nextjs', () => ({
    captureMessage: (...args: unknown[]) => mockCaptureMessage(...args),
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

jest.mock('@/context', () => {
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

jest.mock('@/utils/balance.utils', () => ({
    isAmountWithinBalance: () => true,
}))

jest.mock('@/utils/withdraw.utils', () => ({
    isBelowRhinoMinDeposit: () => false,
}))

jest.mock('@/utils/general.utils', () => ({
    isTxReverted: (receipt: { status?: string } | null) => receipt?.status === 'reverted',
}))

jest.mock('@/utils/url.utils', () => ({
    appBaseUrl: () => 'https://peanut.test',
}))

jest.mock('@/utils/friendly-error.utils', () => ({
    ErrorHandler: (err: unknown) => (err instanceof Error ? err.message : 'Something went wrong'),
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
    default: (props: { onConfirm: () => void }) => (
        <button data-testid="confirm-withdraw" onClick={props.onConfirm}>
            Confirm
        </button>
    ),
}))

jest.mock('@/components/Withdraw/views/Initial.withdraw.view', () => ({
    __esModule: true,
    default: () => <div data-testid="initial-view" />,
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

jest.mock('@/components/Global/PeanutLoading', () => ({
    __esModule: true,
    default: () => <div data-testid="loading" />,
}))

jest.mock('@/components/Slider', () => ({
    Slider: () => <div data-testid="slider" />,
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

const mockWithdrawFlow = {
    amountToWithdraw: '50',
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
jest.mock('@/hooks/wallet/useWallet', () => ({
    useWallet: () => ({
        isConnected: true,
        address: USER_ADDRESS,
        sendMoney: mockSendMoney,
        sendTransactions: mockSendTransactions,
        spendableBalance: 100n * 10n ** 6n,
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

// ---------- helpers ----------

const PAYMENT_RESULT = { uuid: 'payment-1' }

const confirm = async () => {
    render(<WithdrawCryptoPage />)
    fireEvent.click(screen.getByTestId('confirm-withdraw'))
}

beforeEach(() => {
    jest.clearAllMocks()
    mockRecordPayment.mockResolvedValue(PAYMENT_RESULT)
    Object.assign(mockCrossChainTransfer, { isXChain: false, isDiffToken: false })
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
        Object.assign(mockCrossChainTransfer, { isXChain: true })
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
