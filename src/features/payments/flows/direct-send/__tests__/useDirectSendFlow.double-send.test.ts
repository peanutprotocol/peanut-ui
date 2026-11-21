/**
 * Replays the ChargeSendFlow.tla counterexamples (mono
 * engineering/api/state-machines/ChargeSendFlow.tla, Buggy cfgs) against the
 * direct send hook. Each trace ended, before the guard, with Send offered
 * again while the first transfer could still land.
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

const mockWalletAddress: { current: string | undefined } = { current: '0x2222222222222222222222222222222222222222' }
const mockHasSufficientBalance = jest.fn(() => true)
const mockSendMoney = jest.fn()
const mockSendTransactions = jest.fn()
jest.mock('@/hooks/wallet/useWallet', () => ({
    useWallet: () => ({
        isConnected: true,
        spendableBalanceDecimal: '100',
        address: mockWalletAddress.current,
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

jest.mock('@/context/loadingStates.context', () => ({
    useLoadingState: () => ({ setLoadingState: jest.fn() }),
    loadingStateContext: require('react').createContext({ setLoadingState: jest.fn() }),
}))
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))

jest.mock('@/utils/network-triage', () => ({ captureNetworkTriagedFailure: jest.fn() }))
const mockReadUserOpOutcome = jest.fn()
jest.mock('@/utils/userop-outcome', () => ({
    readUserOpOutcome: (...args: unknown[]) => mockReadUserOpOutcome(...args),
}))

import { useDirectSendFlow } from '../useDirectSendFlow'
import { markSpendMayHaveBroadcast } from '@/hooks/wallet/spendBroadcast'

const MARKER_KEY = 'peanut:pendingChargeSend:u1:direct-send:0x1111111111111111111111111111111111111111'
const OP = { userOpHash: `0x${'ab'.repeat(32)}`, nonce: '7' }

const mounted: Array<() => void> = []
function render() {
    const rendered = renderHookWithIntl(() => useDirectSendFlow())
    mounted.push(rendered.unmount)
    return rendered
}
function charge(status: string) {
    return { ...originalCharge, chainId: '42161', status }
}
async function tap(rendered: { result: { current: ReturnType<typeof useDirectSendFlow> } }) {
    let done: Promise<unknown> | undefined
    act(() => {
        done = rendered.result.current.executePayment()
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

beforeEach(() => {
    jest.useFakeTimers()
    jest.clearAllMocks()
    window.localStorage.clear()
    mockWalletAddress.current = '0x2222222222222222222222222222222222222222'
    ctx.charge = null
    ctx.amount = '10'
    ctx.usdAmount = '10'
    ctx.currentView = 'INITIAL'
    mockCreateCharge.mockReset().mockResolvedValue(charge('PENDING'))
    mockGetCharge.mockReset().mockResolvedValue(charge('PENDING'))
    mockSendMoney.mockReset().mockResolvedValue({ txHash: '0xmined' })
    mockRecordPayment.mockReset().mockResolvedValue({ uuid: 'p1' })
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

it('trace 1: a 5xx on recording after a mined send goes to recovery, never to Send again', async () => {
    mockRecordPayment.mockRejectedValue(new Error('Internal Server Error'))
    const rendered = render()
    const { done } = await tap(rendered)

    // recovery holds Send while the charge is read
    expect(rendered.result.current.isLoading).toBe(true)
    expect(mockGetCharge).toHaveBeenCalledWith('charge-1')
    expect(errorShown()).toBe(false)

    // a second tap during recovery sends nothing
    await act(async () => {
        await rendered.result.current.executePayment()
    })
    expect(mockCreateCharge).toHaveBeenCalledTimes(1)
    expect(mockSendMoney).toHaveBeenCalledTimes(1)

    await advance(65_000, done)
    // the same hash is recorded again (the backend answers it idempotently), never a new send
    expect(mockRecordPayment).toHaveBeenCalledTimes(2)
    expect(mockRecordPayment).toHaveBeenLastCalledWith(expect.objectContaining({ txHash: '0xmined' }))
    expect(ctx.setCurrentView).toHaveBeenLastCalledWith('STATUS')
    expect(ctx.setIsSuccess).not.toHaveBeenCalledWith(true)
    expect(errorShown()).toBe(false)
    expect(mockSendMoney).toHaveBeenCalledTimes(1)
})

it('trace 1b: the recovery completes once the re-recorded charge is booked', async () => {
    mockRecordPayment.mockRejectedValueOnce(new Error('socket hang up')).mockResolvedValue({ uuid: 'p2' })
    mockGetCharge.mockResolvedValueOnce(charge('PENDING')).mockResolvedValue(charge('COMPLETED'))
    const rendered = render()
    const { done } = await tap(rendered)
    await advance(0, done)
    expect(ctx.setIsSuccess).toHaveBeenLastCalledWith(true)
    expect(ctx.setCurrentView).toHaveBeenLastCalledWith('STATUS')
    expect(ctx.setPayment).toHaveBeenCalledWith({ uuid: 'p2' })
    expect(window.localStorage.getItem(MARKER_KEY)).toBeNull()
    expect(mockSendMoney).toHaveBeenCalledTimes(1)
})

it('trace 2: a send failure after the broadcast goes to recovery and finds the mined op', async () => {
    mockSendMoney.mockImplementation(
        async (_to: string, _amount: string, opts: { onBroadcast?: (b: unknown) => void }) => {
            opts.onBroadcast?.({ via: 'wallet', userOp: OP })
            throw markSpendMayHaveBroadcast(new Error('bundler request timed out'))
        }
    )
    mockReadUserOpOutcome.mockResolvedValueOnce('unknown').mockResolvedValue({ executed: '0xfound' })
    mockGetCharge
        .mockResolvedValueOnce(charge('PENDING'))
        .mockResolvedValueOnce(charge('PENDING'))
        .mockResolvedValue(charge('COMPLETED'))
    const rendered = render()
    const { done } = await tap(rendered)

    expect(errorShown()).toBe(false)
    expect(rendered.result.current.isLoading).toBe(true)
    expect(JSON.parse(window.localStorage.getItem(MARKER_KEY)!).userOps).toEqual([OP])
    await act(async () => {
        await rendered.result.current.executePayment()
    })
    expect(mockSendMoney).toHaveBeenCalledTimes(1)

    await advance(10_000, done)
    expect(mockReadUserOpOutcome).toHaveBeenCalledWith(OP, '0x2222222222222222222222222222222222222222')
    expect(mockRecordPayment).toHaveBeenCalledWith(expect.objectContaining({ txHash: '0xfound' }))
    expect(ctx.setIsSuccess).toHaveBeenLastCalledWith(true)
    expect(mockSendMoney).toHaveBeenCalledTimes(1)
    expect(window.localStorage.getItem(MARKER_KEY)).toBeNull()
})

it('trace 2b: an op still in flight keeps Send off past the recovery window', async () => {
    mockSendMoney.mockImplementation(
        async (_to: string, _amount: string, opts: { onBroadcast?: (b: unknown) => void }) => {
            opts.onBroadcast?.({ via: 'wallet', userOp: OP })
            throw markSpendMayHaveBroadcast(new Error('fetch failed'))
        }
    )
    const rendered = render()
    const { done } = await tap(rendered)
    await advance(65_000, done)
    expect(ctx.setCurrentView).toHaveBeenLastCalledWith('STATUS')
    expect(ctx.setIsSuccess).not.toHaveBeenCalledWith(true)
    expect(window.localStorage.getItem(MARKER_KEY)).not.toBeNull()
    expect(rendered.result.current.isLoading).toBe(true)
    await act(async () => {
        await rendered.result.current.executePayment()
    })
    expect(mockSendMoney).toHaveBeenCalledTimes(1)
})

it('offers Send again only once the chain proves nothing moved', async () => {
    mockSendMoney.mockImplementation(
        async (_to: string, _amount: string, opts: { onBroadcast?: (b: unknown) => void }) => {
            opts.onBroadcast?.({ via: 'wallet', userOp: OP })
            throw markSpendMayHaveBroadcast(new Error('fetch failed'))
        }
    )
    mockReadUserOpOutcome.mockResolvedValue('replaced')
    const rendered = render()
    const { done } = await tap(rendered)
    await advance(0, done)
    expect(ctx.setError).toHaveBeenLastCalledWith({
        showError: true,
        errorMessage: 'This payment did not go through, and no money left your wallet. You can try again.',
    })
    expect(ctx.setCurrentView).toHaveBeenLastCalledWith('INITIAL')
    expect(window.localStorage.getItem(MARKER_KEY)).toBeNull()
    expect(rendered.result.current.isLoading).toBe(false)
})

it('trace 3: a reload with a pending marker resumes recovery and keeps Send off', async () => {
    window.localStorage.setItem(
        MARKER_KEY,
        JSON.stringify({ chargeId: 'charge-1', startedAt: Date.now(), userOps: [OP], backendBroadcast: false })
    )
    const rendered = render()
    await advance(0)
    expect(rendered.result.current.isLoading).toBe(true)
    expect(mockGetCharge).toHaveBeenCalledWith('charge-1')
    expect(mockReadUserOpOutcome).toHaveBeenCalledWith(OP, expect.any(String))
    await act(async () => {
        await rendered.result.current.executePayment()
    })
    expect(mockCreateCharge).not.toHaveBeenCalled()
    expect(mockSendMoney).not.toHaveBeenCalled()
})

it('a reload before anything was broadcast drops the marker and keeps Send', async () => {
    window.localStorage.setItem(
        MARKER_KEY,
        JSON.stringify({ chargeId: 'charge-1', startedAt: Date.now(), userOps: [], backendBroadcast: false })
    )
    const rendered = render()
    await advance(0)
    expect(window.localStorage.getItem(MARKER_KEY)).toBeNull()
    expect(mockGetCharge).not.toHaveBeenCalled()
    expect(rendered.result.current.isLoading).toBe(false)
})

it('a failure before the broadcast shows the error and keeps Send (no regression)', async () => {
    mockSendMoney.mockRejectedValue(new Error('AA21 did not pay prefund'))
    const rendered = render()
    const { done } = await tap(rendered)
    await advance(0, done)
    expect(errorShown()).toBe(true)
    expect(mockGetCharge).not.toHaveBeenCalled()
    expect(window.localStorage.getItem(MARKER_KEY)).toBeNull()
    expect(rendered.result.current.isLoading).toBe(false)
})

it('after a day, a marker is still read: an op that executed is found, never offered again', async () => {
    window.localStorage.setItem(
        MARKER_KEY,
        JSON.stringify({
            chargeId: 'charge-1',
            startedAt: Date.now() - 25 * 3600_000,
            userOps: [OP],
            backendBroadcast: false,
        })
    )
    mockReadUserOpOutcome.mockResolvedValue({ executed: '0xfound' })
    mockGetCharge.mockResolvedValueOnce(charge('PENDING')).mockResolvedValue(charge('COMPLETED'))
    render()
    await advance(0)
    expect(mockRecordPayment).toHaveBeenCalledWith(expect.objectContaining({ txHash: '0xfound' }))
    expect(ctx.setIsSuccess).toHaveBeenLastCalledWith(true)
    expect(errorShown()).toBe(false)
})

it('after a day, an op still nowhere on chain counts as dropped and Send comes back', async () => {
    window.localStorage.setItem(
        MARKER_KEY,
        JSON.stringify({
            chargeId: 'charge-1',
            startedAt: Date.now() - 25 * 3600_000,
            userOps: [OP],
            backendBroadcast: false,
        })
    )
    const rendered = render()
    await advance(0)
    expect(mockReadUserOpOutcome).toHaveBeenCalled()
    expect(ctx.setCurrentView).toHaveBeenLastCalledWith('INITIAL')
    expect(window.localStorage.getItem(MARKER_KEY)).toBeNull()
    expect(rendered.result.current.isLoading).toBe(false)
})

it('after a reload, the resume waits for the wallet before reading the chain', async () => {
    window.localStorage.setItem(
        MARKER_KEY,
        JSON.stringify({ chargeId: 'charge-1', startedAt: Date.now(), userOps: [OP], backendBroadcast: false })
    )
    mockWalletAddress.current = undefined
    mockReadUserOpOutcome.mockResolvedValue({ executed: '0xfound' })
    mockGetCharge.mockResolvedValueOnce(charge('PENDING')).mockResolvedValue(charge('COMPLETED'))
    const rendered = render()
    await advance(0)
    expect(mockGetCharge).not.toHaveBeenCalled()
    expect(rendered.result.current.isLoading).toBe(true)

    mockWalletAddress.current = '0x2222222222222222222222222222222222222222'
    rendered.rerender()
    await advance(0)
    expect(mockReadUserOpOutcome).toHaveBeenCalledWith(OP, '0x2222222222222222222222222222222222222222')
    expect(ctx.setIsSuccess).toHaveBeenLastCalledWith(true)
})

it('two taps in one tick start one payment: one charge, one send', async () => {
    mockSendMoney.mockImplementation(() => new Promise(() => {}))
    const rendered = render()
    act(() => {
        void rendered.result.current.executePayment()
        void rendered.result.current.executePayment()
    })
    await advance(0)
    expect(mockCreateCharge).toHaveBeenCalledTimes(1)
    expect(mockSendMoney).toHaveBeenCalledTimes(1)
})
