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
        recipientType: 'USERNAME',
        identifier: 'alice',
        resolvedAddress: '0x1111111111111111111111111111111111111111',
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
    resetSemanticRequestFlow: jest.fn(),
    isExternalWalletPayment: false,
    setIsExternalWalletPayment: jest.fn(),
}
jest.mock('../SemanticRequestFlowContext', () => ({ useSemanticRequestFlowContext: () => ctx }))

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
const mockSetChargeAmount = jest.fn()
jest.mock('@/services/charges', () => ({
    chargesApi: { setAmount: (...args: unknown[]) => mockSetChargeAmount(...args) },
}))
jest.mock('@/utils/settled-tx-hash.utils', () => ({
    resolveSettledTxHash: (r: { txHash?: string }) => ({ hash: r.txHash ?? '0xmined' }),
}))

import { useSemanticRequestFlow } from '../useSemanticRequestFlow'

import * as timeoutTypes from '@/utils/sentry.utils'

const unknownSetter = jest.fn()
Object.assign(ctx, { isPaymentStatusUnknown: false, setIsPaymentStatusUnknown: unknownSetter })

function mutationResponseTimeout() {
    const exported = timeoutTypes as unknown as Record<string, { prototype: Error } | undefined>
    return Object.assign(Object.create(exported.MutationResponseTimeoutError?.prototype ?? Error.prototype), {
        name: 'MutationResponseTimeoutError',
        message: 'Response body timed out',
        responseReceived: true,
        outcomeUnknown: true,
        status: 201,
    }) as Error
}
function connectionTimeout() {
    const exported = timeoutTypes as unknown as Record<string, { prototype: Error } | undefined>
    return Object.assign(Object.create(exported.ConnectionTimeoutError?.prototype ?? Error.prototype), {
        name: 'ConnectionTimeoutError',
        message: 'No response arrived',
    }) as Error
}
function booked(status = 'COMPLETED') {
    return { ...originalCharge, status, fulfillmentPayment: status === 'COMPLETED' ? { uuid: 'payment-booked' } : null }
}
async function startPayment() {
    const rendered = renderHookWithIntl(() => useSemanticRequestFlow())
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
    expect(mockSendMoney.mock.calls.length + mockSendTransactions.mock.calls.length).toBe(1)
    expect(mockRecordPayment).toHaveBeenCalledTimes(1)
    expect(ctx.setError).not.toHaveBeenCalledWith(expect.objectContaining({ showError: true }))
    expect(ctx.setIsExternalWalletPayment).not.toHaveBeenCalledWith(true)
}

beforeEach(() => {
    jest.useFakeTimers()
    jest.clearAllMocks()
    ctx.charge = { ...originalCharge, chainId: '42161', requestLink: { ...originalCharge.requestLink } }
    ctx.currentView = 'CONFIRM'
    ctx.amount = '10'
    ctx.usdAmount = '10'
    ctx.chargeIdFromUrl = null
    ctx.isExternalWalletPayment = false
    ctx.recipient.resolvedAddress = originalCharge.requestLink.recipientAddress
    mockTokenSelection.selectedChainID = '42161'
    route.quoteExpiresAt = null
    mockSendMoney.mockReset().mockResolvedValue({ txHash: '0xspent-once' })
    mockSendTransactions.mockReset().mockResolvedValue({ txHash: '0xspent-once' })
    mockRecordPayment.mockReset().mockRejectedValue(mutationResponseTimeout())
    mockFetchCharge.mockReset().mockResolvedValue(booked('PROCESSING'))
    mockCreateCharge.mockReset().mockResolvedValue(ctx.charge)
    mockSetChargeAmount.mockReset().mockResolvedValue(undefined)
})
afterEach(() => {
    jest.clearAllTimers()
    jest.useRealTimers()
})

it('shows confirming while record-payment outcome is unknown, then accepts authoritative completion', async () => {
    let resolveRead!: (value: ReturnType<typeof booked>) => void
    mockFetchCharge.mockImplementationOnce(
        () =>
            new Promise((resolve) => {
                resolveRead = resolve
            })
    )
    const { done } = await startPayment()
    expect(mockFetchCharge).toHaveBeenCalledWith('charge-1')
    expect(ctx.setCurrentView).not.toHaveBeenCalledWith('STATUS')
    expect(ctx.setIsLoading).toHaveBeenLastCalledWith(true)
    expect(unknownSetter).toHaveBeenCalledWith(true)
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
    expect(unknownSetter).toHaveBeenLastCalledWith(false)
    expectNoReplayOrGenericFailure()
})

it('keeps exhausted pending read-back in confirming without replay or generic failure', async () => {
    const { done } = await startPayment()
    await finishPayment(done)
    expect(mockFetchCharge).toHaveBeenCalledWith('charge-1')
    expect(mockFetchCharge.mock.calls.length).toBeGreaterThan(0)
    expect(mockFetchCharge.mock.calls.length).toBeLessThanOrEqual(61)
    expect(ctx.setCurrentView).toHaveBeenLastCalledWith('STATUS')
    expect(unknownSetter).toHaveBeenLastCalledWith(true)
    expect(ctx.setIsSuccess).not.toHaveBeenCalledWith(true)
    expectNoReplayOrGenericFailure()
})

it.each(['FAILED', 'CANCELLED'])('allows generic failure only after authoritative %s', async (status) => {
    mockFetchCharge.mockResolvedValue(booked(status))
    const { done } = await startPayment()
    await finishPayment(done, 0)
    expect(mockFetchCharge).toHaveBeenCalledWith('charge-1')
    expect(ctx.setError).toHaveBeenCalledWith(expect.objectContaining({ showError: true }))
    expect(ctx.setIsSuccess).not.toHaveBeenCalledWith(true)
    expect(mockRecordPayment).toHaveBeenCalledTimes(1)
    expect(mockSendMoney.mock.calls.length + mockSendTransactions.mock.calls.length).toBe(1)
})

it('keeps a no-response record-payment timeout on its existing failure path without read-back', async () => {
    mockRecordPayment.mockRejectedValue(connectionTimeout())
    const { done } = await startPayment()
    await finishPayment(done, 0)
    expect(mockFetchCharge).not.toHaveBeenCalled()
    expect(unknownSetter).not.toHaveBeenCalledWith(true)
    expect(ctx.setError).toHaveBeenCalledWith(expect.objectContaining({ showError: true }))
})

it('does not reconcile a charge-creation response timeout before spending', async () => {
    ctx.charge = null
    ctx.currentView = 'INITIAL'
    mockCreateCharge.mockRejectedValue(mutationResponseTimeout())
    const { result } = renderHookWithIntl(() => useSemanticRequestFlow())
    await act(async () => {
        await result.current.handlePayment()
    })
    expect(mockFetchCharge).not.toHaveBeenCalled()
    expect(mockSendMoney).not.toHaveBeenCalled()
    expect(mockSendTransactions).not.toHaveBeenCalled()
    expect(mockRecordPayment).not.toHaveBeenCalled()
    expect(unknownSetter).not.toHaveBeenCalledWith(true)
    expect(ctx.setError).toHaveBeenCalledWith(expect.objectContaining({ showError: true }))
})

it('does not reconcile open-amount mutation uncertainty before spending', async () => {
    ctx.charge = { ...ctx.charge, tokenAmount: null, openAmount: true } as unknown as typeof originalCharge
    ctx.currentView = 'INITIAL'
    mockSetChargeAmount.mockRejectedValue(mutationResponseTimeout())
    const { result } = renderHookWithIntl(() => useSemanticRequestFlow())
    await act(async () => {
        await result.current.handlePayment()
    })
    expect(mockSetChargeAmount).toHaveBeenCalled()
    expect(mockFetchCharge).not.toHaveBeenCalled()
    expect(mockSendMoney).not.toHaveBeenCalled()
    expect(mockRecordPayment).not.toHaveBeenCalled()
    expect(unknownSetter).not.toHaveBeenCalledWith(true)
    expect(ctx.setError).toHaveBeenCalledWith(expect.objectContaining({ showError: true }))
})

it('fences late charge completion after leaving the screen', async () => {
    let resolveRead!: (value: ReturnType<typeof booked>) => void
    mockFetchCharge.mockImplementationOnce(
        () =>
            new Promise((resolve) => {
                resolveRead = resolve
            })
    )
    const { done, unmount } = await startPayment()
    expect(mockFetchCharge).toHaveBeenCalledWith('charge-1')
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

it('reconciles recording uncertainty through same-chain handlePayment without another spend', async () => {
    ctx.currentView = 'INITIAL'
    ctx.charge = { ...originalCharge, chainId: '42161', requestLink: { ...originalCharge.requestLink } }
    mockTokenSelection.selectedChainID = '42161'
    mockTokenSelection.selectedTokenAddress = originalCharge.tokenAddress
    mockTokenSelection.selectedTokenData.chainId = '42161'
    let resolveRead!: (value: ReturnType<typeof booked>) => void
    mockFetchCharge.mockImplementationOnce(
        () =>
            new Promise((resolve) => {
                resolveRead = resolve
            })
    )
    const { result } = renderHookWithIntl(() => useSemanticRequestFlow())
    let done: Promise<unknown> | undefined
    act(() => {
        done = result.current.handlePayment(false, false)
    })
    await act(async () => {
        await jest.advanceTimersByTimeAsync(0)
    })

    expect(mockSendMoney).toHaveBeenCalledWith(originalCharge.requestLink.recipientAddress, '10', {
        kind: 'REQUEST_PAY',
        chargeId: 'charge-1',
    })
    expect(mockRecordPayment).toHaveBeenCalledTimes(1)
    expect(mockFetchCharge).toHaveBeenCalledWith('charge-1')
    expect(mockFetchCharge.mock.calls.every(([chargeId]) => chargeId === 'charge-1')).toBe(true)
    expect(ctx.setIsLoading).toHaveBeenLastCalledWith(true)
    expect(ctx.setCurrentView).not.toHaveBeenCalledWith('STATUS')
    expect(unknownSetter).toHaveBeenCalledWith(true)
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
    expect(unknownSetter).toHaveBeenLastCalledWith(false)
    expect(ctx.setIsLoading).toHaveBeenLastCalledWith(false)
    expectNoReplayOrGenericFailure()
})
