/**
 * Replays the ChargeSendFlow.tla counterexamples
 * (verification/tla/ChargeSendFlow.tla, Buggy cfgs) against the
 * request pay hook. Before the guard, Pay came back on the SAME charge after a
 * failure that followed the send, and a reload offered it again.
 */
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

jest.mock('@/utils/network-triage', () => ({ captureNetworkTriagedFailure: jest.fn() }))
const mockReadUserOpOutcome = jest.fn()
jest.mock('@/utils/userop-outcome', () => ({
    readUserOpOutcome: (...args: unknown[]) => mockReadUserOpOutcome(...args),
}))

import { useSemanticRequestFlow } from '../useSemanticRequestFlow'
import { markSpendMayHaveBroadcast } from '@/hooks/wallet/spendBroadcast'

Object.assign(ctx, { isPaymentStatusUnknown: false, setIsPaymentStatusUnknown: jest.fn() })

const MARKER_KEY = 'peanut:pendingChargeSend:u1:request:0x1111111111111111111111111111111111111111'
const OP = { userOpHash: `0x${'ef'.repeat(32)}`, nonce: '9' }
const charge = (status: string) => ({ ...originalCharge, chainId: '42161', status })

const mounted: Array<() => void> = []
function render() {
    const rendered = renderHookWithIntl(() => useSemanticRequestFlow())
    mounted.push(rendered.unmount)
    return rendered
}
type Flow = { result: { current: ReturnType<typeof useSemanticRequestFlow> } }
async function start(run: () => Promise<unknown>) {
    let done: Promise<unknown> | undefined
    act(() => {
        done = run()
    })
    await act(async () => {
        await jest.advanceTimersByTimeAsync(0)
    })
    // wrapped: an async function returning the promise would wait for it
    return { done }
}
async function advance(ms: number, done?: Promise<unknown>) {
    await act(async () => {
        await jest.advanceTimersByTimeAsync(ms)
        await done
    })
}
const errorShown = () => jest.mocked(ctx.setError).mock.calls.some(([e]) => (e as { showError: boolean }).showError)
const spends = () => mockSendMoney.mock.calls.length + mockSendTransactions.mock.calls.length

beforeEach(() => {
    jest.useFakeTimers()
    jest.clearAllMocks()
    window.localStorage.clear()
    ctx.charge = { ...originalCharge, chainId: '42161', requestLink: { ...originalCharge.requestLink } }
    ctx.currentView = 'CONFIRM'
    ctx.amount = '10'
    ctx.usdAmount = '10'
    ctx.chargeIdFromUrl = null
    ctx.isExternalWalletPayment = false
    ctx.recipient.resolvedAddress = originalCharge.requestLink.recipientAddress
    mockTokenSelection.selectedChainID = '42161'
    mockTokenSelection.selectedTokenAddress = originalCharge.tokenAddress
    mockTokenSelection.selectedTokenData.chainId = '42161'
    route.quoteExpiresAt = null
    mockSendMoney.mockReset().mockResolvedValue({ txHash: '0xmined' })
    mockSendTransactions.mockReset().mockResolvedValue({ txHash: '0xmined' })
    mockRecordPayment.mockReset().mockResolvedValue({ uuid: 'p1' })
    mockFetchCharge.mockReset().mockResolvedValue(charge('PENDING'))
    mockCreateCharge.mockReset().mockResolvedValue(ctx.charge)
    mockSetChargeAmount.mockReset().mockResolvedValue(undefined)
    mockReadUserOpOutcome.mockReset().mockResolvedValue('unknown')
})
afterEach(async () => {
    // leaving the screen ends a recovery at its next step; let it get there
    act(() => mounted.splice(0).forEach((unmount) => unmount()))
    await act(async () => {
        await jest.advanceTimersByTimeAsync(5_000)
    })
    jest.clearAllTimers()
    jest.useRealTimers()
})

it('trace 1 (confirm path): a 5xx on recording after a mined send never offers Pay on the same charge', async () => {
    mockRecordPayment.mockRejectedValue(new Error('Internal Server Error'))
    const rendered: Flow = render()
    const { done } = await start(() => rendered.result.current.executePayment())
    expect(rendered.result.current.isLoading).toBe(true)
    expect(errorShown()).toBe(false)
    await act(async () => {
        await rendered.result.current.executePayment()
    })
    expect(spends()).toBe(1)

    await advance(65_000, done)
    expect(mockRecordPayment).toHaveBeenLastCalledWith(expect.objectContaining({ txHash: '0xmined' }))
    expect(ctx.setCurrentView).toHaveBeenLastCalledWith('STATUS')
    expect(ctx.setIsSuccess).not.toHaveBeenCalledWith(true)
    expect(errorShown()).toBe(false)
    expect(spends()).toBe(1)
})

it('trace 1 (direct path): handlePayment after a record failure does not pay the same charge again', async () => {
    ctx.currentView = 'INITIAL'
    mockRecordPayment.mockRejectedValue(new Error('Load failed'))
    const rendered: Flow = render()
    const { done } = await start(() => rendered.result.current.handlePayment(false, false))
    expect(errorShown()).toBe(false)
    await act(async () => {
        await rendered.result.current.handlePayment(false, false)
    })
    expect(spends()).toBe(1)
    await advance(65_000, done)
    expect(ctx.setCurrentView).toHaveBeenLastCalledWith('STATUS')
    expect(spends()).toBe(1)
})

it('trace 2: a send failure after the broadcast goes to recovery, with no second send', async () => {
    mockSendMoney.mockImplementation(
        async (_to: string, _amount: string, opts: { onBroadcast?: (b: unknown) => void }) => {
            opts.onBroadcast?.({ via: 'wallet', userOp: OP })
            throw markSpendMayHaveBroadcast(new Error('bundler request timed out'))
        }
    )
    mockReadUserOpOutcome.mockResolvedValueOnce('unknown').mockResolvedValue({ executed: '0xfound' })
    mockFetchCharge
        .mockResolvedValueOnce(charge('PENDING'))
        .mockResolvedValueOnce(charge('PENDING'))
        .mockResolvedValue(charge('COMPLETED'))
    const rendered: Flow = render()
    const { done } = await start(() => rendered.result.current.executePayment())
    expect(errorShown()).toBe(false)
    await act(async () => {
        await rendered.result.current.executePayment()
    })
    expect(spends()).toBe(1)

    await advance(10_000, done)
    expect(mockRecordPayment).toHaveBeenCalledWith(expect.objectContaining({ txHash: '0xfound' }))
    expect(ctx.setIsSuccess).toHaveBeenLastCalledWith(true)
    expect(spends()).toBe(1)
    expect(window.localStorage.getItem(MARKER_KEY)).toBeNull()
})

it('trace 3: a reload with a pending marker resumes recovery and keeps Pay off', async () => {
    window.localStorage.setItem(
        MARKER_KEY,
        JSON.stringify({ chargeId: 'charge-1', startedAt: Date.now(), userOps: [OP], backendBroadcast: false })
    )
    const rendered: Flow = render()
    await advance(0)
    expect(rendered.result.current.isLoading).toBe(true)
    expect(mockFetchCharge).toHaveBeenCalledWith('charge-1')
    await act(async () => {
        await rendered.result.current.executePayment()
    })
    expect(spends()).toBe(0)
})
