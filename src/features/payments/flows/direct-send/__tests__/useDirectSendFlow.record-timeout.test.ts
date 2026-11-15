import { act } from '@testing-library/react'
import { renderHookWithIntl } from '@/test-utils/intl'

const originalCharge = {
    uuid: 'charge-1',
    chainId: '8453',
    tokenAddress: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    tokenAmount: '10',
    tokenDecimals: 6,
    tokenType: '1',
    tokenSymbol: 'USDC',
    requestLink: {
        recipientAddress: '0x1111111111111111111111111111111111111111',
        recipientAccount: { userId: 'peer-user' },
    },
}

const ctx = {
    amount: '10',
    setAmount: jest.fn(),
    usdAmount: '10',
    setUsdAmount: jest.fn(),
    currentView: 'CONFIRM',
    setCurrentView: jest.fn(),
    parsedUrl: null,
    recipient: {
        username: 'alice',
        userId: 'peer-user',
        person: null,
        address: '0x1111111111111111111111111111111111111111',
    },
    chargeIdFromUrl: null as string | null,
    isAmountFromUrl: false,
    isTokenFromUrl: false,
    isChainFromUrl: false,
    attachment: {},
    setAttachment: jest.fn(),
    charge: originalCharge as typeof originalCharge | null,
    setCharge: jest.fn(),
    payment: null,
    setPayment: jest.fn(),
    txHash: null,
    setTxHash: jest.fn(),
    error: { showError: false, errorMessage: '' },
    setError: jest.fn(),
    isLoading: false,
    setIsLoading: jest.fn(),
    isSuccess: false,
    setIsSuccess: jest.fn(),
    resetSendFlow: jest.fn(),
    isExternalWalletPayment: false,
    setIsExternalWalletPayment: jest.fn(),
}
jest.mock('../DirectSendFlowContext', () => ({ useDirectSendFlowContext: () => ctx }))

const mockCreateCharge = jest.fn()
const mockFetchCharge = jest.fn()
jest.mock('@/features/payments/shared/hooks/useChargeManager', () => ({
    useChargeManager: () => ({
        createCharge: mockCreateCharge,
        fetchCharge: (...args: unknown[]) => mockFetchCharge(...args),
        isCreating: false,
        isFetching: false,
    }),
}))
const mockRecordPayment = jest.fn().mockResolvedValue({ uuid: 'p1' })
jest.mock('@/features/payments/shared/hooks/usePaymentRecorder', () => ({
    usePaymentRecorder: () => ({
        recordPayment: mockRecordPayment,
        isRecording: false,
        reset: jest.fn(),
    }),
}))

const mockCalculate = jest.fn()
const route = {
    transactions: [{ to: '0x3333333333333333333333333333333333333333', data: '0x' }],
    receiveAmount: '10',
    payAmount: '10',
    feeUsd: 0,
    estimatedGasCostUsd: 0,
    isCalculating: false,
    isFeeEstimationError: false,
    error: null,
    quoteExpiresAt: null as string | null,
    calculate: (...args: unknown[]) => mockCalculate(...args),
    reset: jest.fn(),
}
jest.mock('@/features/payments/shared/hooks/useCrossChainTransfer', () => ({ useCrossChainTransfer: () => route }))

const mockHasSufficientBalance = jest.fn(() => true)
const mockSendMoney = jest.fn()
const mockSendTransactions = jest.fn()
jest.mock('@/hooks/wallet/useWallet', () => ({
    useWallet: () => ({
        isConnected: true,
        spendableBalanceDecimal: '100',
        address: '0x2222222222222222222222222222222222222222',
        sendMoney: mockSendMoney,
        sendTransactions: (...args: unknown[]) => mockSendTransactions(...args),
        formattedSpendableBalance: '100',
        hasSufficientSpendableBalance: mockHasSufficientBalance,
        isFetchingSpendableBalance: false,
    }),
}))
jest.mock('@/context/authContext', () => ({ useAuth: () => ({ user: { user: { userId: 'u1' } } }) }))
const mockRefetchTokenData = jest.fn()
const mockTokenSelection = {
    refetchTokenData: mockRefetchTokenData,
    selectedChainID: '8453',
    selectedTokenAddress: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    selectedTokenData: {
        address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
        chainId: '8453',
        decimals: 6,
        symbol: 'USDC',
        price: 1,
    },
    setSelectedChainID: jest.fn(),
    setSelectedTokenAddress: jest.fn(),
}
jest.mock('@/context/tokenSelector.context', () => {
    const ReactActual = jest.requireActual('react')
    return {
        tokenSelectorContext: ReactActual.createContext(mockTokenSelection),
    }
})
jest.mock('@/constants/zerodev.consts', () => ({
    PEANUT_WALLET_CHAIN: { id: 42161 },
    PEANUT_WALLET_TOKEN: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    PEANUT_WALLET_TOKEN_DECIMALS: 6,
    PEANUT_WALLET_TOKEN_SYMBOL: 'USDC',
}))
jest.mock('@/hooks/useFriendlyError', () => ({ useFriendlyError: () => (e: unknown) => String(e) }))
jest.mock('@tanstack/react-query', () => ({
    useQueryClient: () => ({ invalidateQueries: jest.fn(), refetchQueries: jest.fn() }),
}))
jest.mock('@/constants/query.consts', () => ({ TRANSACTIONS: 'transactions' }))
const mockGetCharge = jest.fn()
jest.mock('@/services/charges', () => ({
    chargesApi: { get: (...args: unknown[]) => mockGetCharge(...args) },
}))
jest.mock('@/utils/settled-tx-hash.utils', () => ({
    resolveSettledTxHash: (r: { txHash?: string }) => ({ hash: r.txHash ?? '0xmined' }),
}))

import { useDirectSendFlow } from '../useDirectSendFlow'
jest.mock('@/context/loadingStates.context', () => ({
    useLoadingState: () => ({ setLoadingState: jest.fn() }),
    loadingStateContext: require('react').createContext({ setLoadingState: jest.fn() }),
}))
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))

import * as timeoutTypes from '@/utils/sentry.utils'

function timeoutError(responseReceived = true) {
    const exported = timeoutTypes as unknown as Record<string, { prototype: Error } | undefined>
    const name = responseReceived ? 'MutationResponseTimeoutError' : 'ConnectionTimeoutError'
    return Object.assign(Object.create(exported[name]?.prototype ?? Error.prototype), {
        name,
        message: 'Payment recording timed out',
        ...(responseReceived ? { responseReceived: true, outcomeUnknown: true, status: 201 } : {}),
    }) as Error
}
function booked(status = 'COMPLETED') {
    return { ...originalCharge, status, fulfillmentPayment: status === 'COMPLETED' ? { uuid: 'booked-payment' } : null }
}
async function startPayment() {
    const rendered = renderHookWithIntl(() => useDirectSendFlow())
    let done: Promise<unknown> | undefined
    act(() => {
        done = rendered.result.current.executePayment()
    })
    await act(async () => {
        await jest.advanceTimersByTimeAsync(0)
    })
    return { ...rendered, done }
}
async function finishPayment(done: Promise<unknown> | undefined, duration = 65_000) {
    await act(async () => {
        await jest.advanceTimersByTimeAsync(duration)
        await done
    })
}
function expectNoReplayOrGenericFailure() {
    expect(mockSendMoney).toHaveBeenCalledTimes(1)
    expect(mockRecordPayment).toHaveBeenCalledTimes(1)
    expect(ctx.setError).not.toHaveBeenCalledWith(expect.objectContaining({ showError: true }))
}

beforeEach(() => {
    jest.useFakeTimers()
    jest.clearAllMocks()
    ctx.charge = { ...originalCharge, chainId: '42161' }
    ctx.amount = '10'
    ctx.usdAmount = '10'
    ctx.currentView = 'CONFIRM'
    mockCreateCharge.mockReset().mockResolvedValue(ctx.charge)
    mockGetCharge.mockReset().mockResolvedValue(booked('PROCESSING'))
    mockSendMoney.mockReset().mockResolvedValue({ txHash: '0xspent-once' })
    mockRecordPayment.mockReset().mockRejectedValue(timeoutError())
})
afterEach(() => {
    jest.clearAllTimers()
    jest.useRealTimers()
})

it('keeps unresolved recording unsuccessful, then accepts only authoritative completion', async () => {
    let resolveRead!: (value: ReturnType<typeof booked>) => void
    mockGetCharge.mockImplementationOnce(
        () =>
            new Promise((resolve) => {
                resolveRead = resolve
            })
    )
    const { done } = await startPayment()
    expect(mockRecordPayment).toHaveBeenCalledTimes(1)
    expect(mockGetCharge).toHaveBeenCalledWith('charge-1')
    expect(ctx.setIsSuccess).not.toHaveBeenCalledWith(true)
    expectNoReplayOrGenericFailure()

    const completed = booked()
    await act(async () => {
        resolveRead(completed)
    })
    await finishPayment(done, 0)
    expect(ctx.setCharge).toHaveBeenLastCalledWith(completed)
    expect(ctx.setCurrentView).toHaveBeenLastCalledWith('STATUS')
    expect(ctx.setIsSuccess).toHaveBeenLastCalledWith(true)
    expectNoReplayOrGenericFailure()
})

it('keeps exhausted pending read-back on STATUS without success, failure, or replay', async () => {
    const { done } = await startPayment()
    await finishPayment(done)
    expect(mockRecordPayment).toHaveBeenCalledTimes(1)
    expect(mockGetCharge).toHaveBeenCalledWith('charge-1')
    expect(mockGetCharge.mock.calls.length).toBeLessThanOrEqual(61)
    expect(ctx.setCurrentView).toHaveBeenLastCalledWith('STATUS')
    expect(ctx.setIsSuccess).toHaveBeenLastCalledWith(false)
    expectNoReplayOrGenericFailure()
})

it.each(['FAILED', 'CANCELLED'])('allows generic failure only after authoritative %s', async (status) => {
    mockGetCharge.mockResolvedValue(booked(status))
    const { done } = await startPayment()
    await finishPayment(done, 0)
    expect(mockRecordPayment).toHaveBeenCalledTimes(1)
    expect(mockGetCharge).toHaveBeenCalledWith('charge-1')
    expect(ctx.setError).toHaveBeenCalledWith(expect.objectContaining({ showError: true }))
    expect(ctx.setIsSuccess).not.toHaveBeenCalledWith(true)
    expect(mockSendMoney).toHaveBeenCalledTimes(1)
})

it('keeps no-response recording timeout as generic failure without reconciliation', async () => {
    mockRecordPayment.mockRejectedValue(timeoutError(false))
    const { done } = await startPayment()
    await finishPayment(done, 0)
    expect(mockRecordPayment).toHaveBeenCalledTimes(1)
    expect(mockGetCharge).not.toHaveBeenCalled()
    expect(ctx.setError).toHaveBeenCalledWith(expect.objectContaining({ showError: true }))
})

it('never reconciles charge creation uncertainty before spending', async () => {
    ctx.charge = null
    mockCreateCharge.mockRejectedValue(timeoutError())
    const { done } = await startPayment()
    await finishPayment(done, 0)
    expect(mockGetCharge).not.toHaveBeenCalled()
    expect(mockSendMoney).not.toHaveBeenCalled()
    expect(mockRecordPayment).not.toHaveBeenCalled()
    expect(ctx.setError).toHaveBeenCalledWith(expect.objectContaining({ showError: true }))
})

it('fences late authoritative completion after leaving the screen', async () => {
    let resolveRead!: (value: ReturnType<typeof booked>) => void
    mockGetCharge.mockImplementationOnce(
        () =>
            new Promise((resolve) => {
                resolveRead = resolve
            })
    )
    const { done, unmount } = await startPayment()
    expect(mockRecordPayment).toHaveBeenCalledTimes(1)
    expect(mockGetCharge).toHaveBeenCalledWith('charge-1')
    unmount()
    jest.mocked(ctx.setCharge).mockClear()
    jest.mocked(ctx.setCurrentView).mockClear()
    jest.mocked(ctx.setIsSuccess).mockClear()
    await act(async () => {
        resolveRead(booked())
    })
    await finishPayment(done)
    expect(ctx.setCharge).not.toHaveBeenCalled()
    expect(ctx.setCurrentView).not.toHaveBeenCalled()
    expect(ctx.setIsSuccess).not.toHaveBeenCalledWith(true)
    expect(mockRecordPayment).toHaveBeenCalledTimes(1)
})
