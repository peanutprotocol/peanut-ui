/**
 * Replays the ChargeSendFlow.tla counterexamples
 * (verification/tla/ChargeSendFlow.tla, Buggy cfgs) against the
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
    resolveSettledTxHash: (r: {
        txHash?: string
        userOpHash?: string
        receipt?: { transactionHash: string } | null
    }) =>
        r.receipt?.transactionHash
            ? { hash: r.receipt.transactionHash, source: 'receipt' as const }
            : r.txHash
              ? { hash: r.txHash, source: 'txHash' as const }
              : r.userOpHash
                ? { hash: r.userOpHash, source: 'userOpHash' as const }
                : { hash: '0xmined', source: 'receipt' as const },
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
import { writePendingChargeSend } from '@/features/payments/shared/utils/pending-charge-send'

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
const lastError = () =>
    (jest.mocked(ctx.setError).mock.calls.at(-1)?.[0] as { errorMessage: string } | undefined)?.errorMessage
// payment.errors.externalPaymentNotConfirmed and payment.errors.paymentNotSent (en)
const NOT_CONFIRMED = 'This payment could not be confirmed. If money left your wallet, contact support.'
const NOT_SENT = 'This payment did not go through, and no money left your wallet. You can try again.'
const DAY_AGO = () => Date.now() - 25 * 3600_000
const marker = (fields: object) =>
    window.localStorage.setItem(
        MARKER_KEY,
        JSON.stringify({ chargeId: 'charge-1', startedAt: Date.now(), userOps: [], backendBroadcast: false, ...fields })
    )

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
    // a marker storage refused lives in page memory, which outlives a test
    writePendingChargeSend(MARKER_KEY, null)
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
    mockReadUserOpOutcome.mockResolvedValue('reverted')
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

it('after a day, an op every read found nowhere may still run: Send comes back with the warning, never as "not sent"', async () => {
    window.localStorage.setItem(
        MARKER_KEY,
        JSON.stringify({
            chargeId: 'charge-1',
            startedAt: Date.now() - 25 * 3600_000,
            userOps: [OP],
            backendBroadcast: false,
        })
    )
    mockReadUserOpOutcome.mockResolvedValue('not-found')
    const rendered = render()
    await advance(0)
    expect(mockReadUserOpOutcome).toHaveBeenCalled()
    expect(ctx.setCurrentView).toHaveBeenLastCalledWith('INITIAL')
    expect(lastError()).toBe(NOT_CONFIRMED)
    expect(window.localStorage.getItem(MARKER_KEY)).toBeNull()
    expect(rendered.result.current.isLoading).toBe(false)
})

it('within a day, an op every read found nowhere keeps Send off: it may still run', async () => {
    marker({ userOps: [OP] })
    mockReadUserOpOutcome.mockResolvedValue('not-found')
    const rendered = render()
    await advance(65_000)
    expect(ctx.setCurrentView).not.toHaveBeenCalledWith('INITIAL')
    expect(window.localStorage.getItem(MARKER_KEY)).not.toBeNull()
    expect(rendered.result.current.isLoading).toBe(true)
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

it('two taps in one tick start one payment: one charge, one send (BuggySameTick)', async () => {
    let refuse!: (error: Error) => void
    mockSendMoney.mockImplementation(() => new Promise((_resolve, reject) => (refuse = reject)))
    const rendered = render()
    act(() => {
        void rendered.result.current.executePayment()
        void rendered.result.current.executePayment()
    })
    await advance(0)
    expect(mockCreateCharge).toHaveBeenCalledTimes(1)
    expect(mockSendMoney).toHaveBeenCalledTimes(1)
    // end the attempt cleanly, so no send stays running for the next case
    refuse(new Error('AA21 did not pay prefund'))
    await advance(0)
})

/*
 * Chip's review of ui#4198: four paths that offered Send again before it was
 * proven the first transfer cannot land twice. Each replays one Buggy config
 * of verification/tla/ChargeSendFlow.tla.
 */
const quotaExceeded = () => {
    throw new DOMException('quota exceeded', 'QuotaExceededError')
}

it('Chip #1 (BuggySentDeadline): money moved and recording keeps failing: the marker outlives the window, and the next visit books the hash', async () => {
    mockRecordPayment.mockRejectedValue(new Error('Internal Server Error'))
    const rendered = render()
    const { done } = await tap(rendered)
    await advance(65_000, done)
    expect(ctx.setCurrentView).toHaveBeenLastCalledWith('STATUS')
    expect(ctx.setIsSuccess).not.toHaveBeenCalledWith(true)
    expect(JSON.parse(window.localStorage.getItem(MARKER_KEY) ?? 'null')?.txHash).toBe('0xmined')
    expect(rendered.result.current.isLoading).toBe(true)
    await act(async () => {
        await rendered.result.current.executePayment()
    })
    expect(mockSendMoney).toHaveBeenCalledTimes(1)

    // the next visit resumes and books the same hash
    act(() => mounted.pop()?.())
    mockRecordPayment.mockReset().mockResolvedValue({ uuid: 'p3' })
    mockGetCharge.mockReset().mockResolvedValueOnce(charge('PENDING')).mockResolvedValue(charge('COMPLETED'))
    render()
    await advance(0)
    expect(mockRecordPayment).toHaveBeenCalledWith(expect.objectContaining({ txHash: '0xmined' }))
    expect(ctx.setIsSuccess).toHaveBeenLastCalledWith(true)
    expect(window.localStorage.getItem(MARKER_KEY)).toBeNull()
    expect(mockSendMoney).toHaveBeenCalledTimes(1)
})

/*
 * Audit of wave 1 (ChargeSendFlow.tla, _BuggyPermanentHold): a hold no proof
 * ends lasted for good. It now lasts one day: within it Send stays off, after
 * it the next visit offers Send again with the "could not be confirmed"
 * warning. A failed read still proves nothing (Chip #2, _BuggyUnknownByAge):
 * the release after a day never says "not sent".
 */
it.each([
    ['an op whose reads fail', { userOps: [OP] }, 'unknown'],
    ['an op whose nonce is spent with no receipt for it or a sibling', { userOps: [OP] }, 'nonce-spent'],
    ['a card-balance broadcast on an open charge', { backendBroadcast: true }, 'unknown'],
    ['an op whose hash was never known', { untrackedBroadcast: true }, 'unknown'],
    ['money that moved into a charge that closed unbooked', { txHash: '0xmined' }, 'unknown'],
    ['money that moved while recording keeps failing', { txHash: '0xmined' }, 'unknown'],
])('%s: Send stays off within a day', async (label, fields, outcome) => {
    marker(fields)
    mockReadUserOpOutcome.mockResolvedValue(outcome)
    if (label.includes('closed')) mockGetCharge.mockResolvedValue(charge('CANCELLED'))
    if (label.includes('recording')) mockRecordPayment.mockRejectedValue(new Error('Internal Server Error'))
    const rendered = render()
    await advance(65_000)
    expect(ctx.setCurrentView).not.toHaveBeenCalledWith('INITIAL')
    expect(window.localStorage.getItem(MARKER_KEY)).not.toBeNull()
    expect(rendered.result.current.isLoading).toBe(true)
})

it.each([
    ['an op whose reads fail', { userOps: [OP] }, 'unknown'],
    ['an op whose nonce is spent with no receipt for it or a sibling', { userOps: [OP] }, 'nonce-spent'],
    ['a card-balance broadcast on an open charge', { backendBroadcast: true }, 'unknown'],
    ['an op whose hash was never known', { untrackedBroadcast: true }, 'unknown'],
    ['money that moved into a charge that closed unbooked', { txHash: '0xmined' }, 'unknown'],
    ['money that moved while recording keeps failing', { txHash: '0xmined' }, 'unknown'],
])('%s: after a day, Send comes back with the warning (BuggyPermanentHold)', async (label, fields, outcome) => {
    marker({ startedAt: DAY_AGO(), ...fields })
    mockReadUserOpOutcome.mockResolvedValue(outcome)
    if (label.includes('reads fail')) mockGetCharge.mockRejectedValue(new TypeError('Failed to fetch'))
    if (label.includes('closed')) mockGetCharge.mockResolvedValue(charge('CANCELLED'))
    if (label.includes('recording')) mockRecordPayment.mockRejectedValue(new Error('Internal Server Error'))
    const rendered = render()
    await advance(0)
    expect(ctx.setCurrentView).toHaveBeenLastCalledWith('INITIAL')
    expect(lastError()).toBe(NOT_CONFIRMED)
    expect(lastError()).not.toBe(NOT_SENT)
    expect(window.localStorage.getItem(MARKER_KEY)).toBeNull()
    expect(rendered.result.current.isLoading).toBe(false)
    expect(mockSendMoney).not.toHaveBeenCalled()
})

it('after a day, a charge that booked still ends on success, not on the warning', async () => {
    marker({ startedAt: DAY_AGO(), txHash: '0xmined' })
    mockGetCharge.mockResolvedValue(charge('COMPLETED'))
    render()
    await advance(0)
    expect(ctx.setIsSuccess).toHaveBeenLastCalledWith(true)
    expect(errorShown()).toBe(false)
})

/*
 * Audit of wave 1 (ChargeSendFlow.tla, _BuggyRefuseOnStorageFail): when local
 * storage refused the marker, the payment was refused, so private-mode and
 * full-storage users could not pay. Now the marker lives in page memory and
 * the payment goes on as it did before the guard.
 */
it('storage refuses the marker: the payment goes through as before the guard', async () => {
    const setItem = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(quotaExceeded)
    try {
        const rendered = render()
        const { done } = await tap(rendered)
        await advance(0, done)
        expect(mockSendMoney).toHaveBeenCalledTimes(1)
        expect(mockRecordPayment).toHaveBeenCalledWith(expect.objectContaining({ txHash: '0xmined' }))
        expect(ctx.setIsSuccess).toHaveBeenLastCalledWith(true)
        expect(errorShown()).toBe(false)
        expect(rendered.result.current.isLoading).toBe(false)
    } finally {
        setItem.mockRestore()
    }
})

it('storage refuses the marker: after a lost answer the guard still holds on this page', async () => {
    mockSendMoney.mockImplementation(
        async (_to: string, _amount: string, opts: { onBroadcast?: (b: unknown) => void }) => {
            opts.onBroadcast?.({ via: 'wallet', userOp: OP })
            throw markSpendMayHaveBroadcast(new Error('bundler request timed out'))
        }
    )
    const setItem = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(quotaExceeded)
    try {
        const rendered = render()
        await tap(rendered)
        expect(mockSendMoney).toHaveBeenCalledTimes(1)
        expect(window.localStorage.getItem(MARKER_KEY)).toBeNull()
        expect(rendered.result.current.isLoading).toBe(true)
        await act(async () => {
            await rendered.result.current.executePayment()
        })
        expect(mockSendMoney).toHaveBeenCalledTimes(1)
        expect(mockCreateCharge).toHaveBeenCalledTimes(1)
    } finally {
        setItem.mockRestore()
    }
})

it('Chip #5 (BuggySpentNonce): a spent nonce without the op receipt keeps Send off: the op may be the one that spent it', async () => {
    window.localStorage.setItem(
        MARKER_KEY,
        JSON.stringify({ chargeId: 'charge-1', startedAt: Date.now(), userOps: [OP], backendBroadcast: false })
    )
    mockReadUserOpOutcome.mockResolvedValue('nonce-spent')
    const rendered = render()
    await advance(65_000)
    expect(ctx.setCurrentView).not.toHaveBeenCalledWith('INITIAL')
    expect(window.localStorage.getItem(MARKER_KEY)).not.toBeNull()
    expect(rendered.result.current.isLoading).toBe(true)
})

it('a spent nonce is proven taken when another saved op of that nonce reverted: Send comes back', async () => {
    const sibling = { userOpHash: `0x${'cd'.repeat(32)}`, nonce: OP.nonce }
    window.localStorage.setItem(
        MARKER_KEY,
        JSON.stringify({ chargeId: 'charge-1', startedAt: Date.now(), userOps: [OP, sibling], backendBroadcast: false })
    )
    mockReadUserOpOutcome.mockImplementation(async (op: { userOpHash: string }) =>
        op.userOpHash === OP.userOpHash ? 'nonce-spent' : 'reverted'
    )
    const rendered = render()
    await advance(0)
    expect(ctx.setCurrentView).toHaveBeenLastCalledWith('INITIAL')
    expect(window.localStorage.getItem(MARKER_KEY)).toBeNull()
    expect(rendered.result.current.isLoading).toBe(false)
})
