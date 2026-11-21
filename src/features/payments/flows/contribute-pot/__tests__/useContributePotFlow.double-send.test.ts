/**
 * Replays the ChargeSendFlow.tla counterexamples (mono
 * engineering/api/state-machines/ChargeSendFlow.tla, Buggy cfgs) against the
 * pot contribution hook: before the guard, each ended with a second
 * contribution on offer while the first could still land.
 */
import { act } from '@testing-library/react'
import { renderHookWithIntl } from '@/test-utils/intl'

const peer = '0x1111111111111111111111111111111111111111'
const mockCreateCharge = jest.fn()
const mockFetchCharge = jest.fn()
const mockRecordPayment = jest.fn()
const mockSendMoney = jest.fn()
const ctx: Record<string, unknown> = {}
const resetCtx = () =>
    Object.assign(ctx, {
        amount: '33.05',
        usdAmount: '33.05',
        request: { uuid: 'request-1' },
        recipient: { address: peer, userId: 'peer-user' },
        attachment: {},
        contributors: [],
        totalAmount: 99.16,
        totalCollected: 0,
        charge: null,
        error: { showError: false, errorMessage: '' },
        setError: jest.fn(),
        setIsLoading: jest.fn(),
        setCharge: jest.fn(),
        setPayment: jest.fn(),
        setTxHash: jest.fn(),
        setIsSuccess: jest.fn(),
        setCurrentView: jest.fn(),
        refetchRequestPot: jest.fn(),
        setIsExternalWalletPayment: jest.fn(),
    })
jest.mock('../ContributePotFlowContext', () => ({ useContributePotFlowContext: () => ctx }))
jest.mock('@/features/payments/shared/hooks/useChargeManager', () => ({
    useChargeManager: () => ({ createCharge: mockCreateCharge, fetchCharge: mockFetchCharge }),
}))
jest.mock('@/features/payments/shared/hooks/usePaymentRecorder', () => ({
    usePaymentRecorder: () => ({ recordPayment: mockRecordPayment }),
}))
jest.mock('@/hooks/wallet/useWallet', () => ({
    useWallet: () => ({
        address: '0x2222222222222222222222222222222222222222',
        sendMoney: mockSendMoney,
        hasSufficientSpendableBalance: () => true,
    }),
}))
jest.mock('@/context/authContext', () => ({ useAuth: () => ({ user: { user: { userId: 'payer-1' } } }) }))
jest.mock('@/hooks/useFriendlyError', () => ({ useFriendlyError: () => String }))
jest.mock('@/constants/zerodev.consts', () => ({
    PEANUT_WALLET_CHAIN: { id: 42161 },
    PEANUT_WALLET_TOKEN: peer,
    PEANUT_WALLET_TOKEN_DECIMALS: 6,
}))

jest.mock('@/utils/network-triage', () => ({ captureNetworkTriagedFailure: jest.fn() }))
const mockReadUserOpOutcome = jest.fn()
jest.mock('@/utils/userop-outcome', () => ({
    readUserOpOutcome: (...args: unknown[]) => mockReadUserOpOutcome(...args),
}))

import { useContributePotFlow } from '../useContributePotFlow'
import { markSpendMayHaveBroadcast } from '@/hooks/wallet/spendBroadcast'

const MARKER_KEY = 'peanut:pendingChargeSend:payer-1:pot:request-1'
const OP = { userOpHash: `0x${'cd'.repeat(32)}`, nonce: '3' }
const openCharge = (status = 'PENDING') => ({
    uuid: 'charge-1',
    tokenAmount: '33.05',
    status,
    requestLink: { uuid: 'request-1' },
})

const mounted: Array<() => void> = []
function render() {
    const rendered = renderHookWithIntl(() => useContributePotFlow())
    mounted.push(rendered.unmount)
    return rendered
}
async function tap(rendered: { result: { current: ReturnType<typeof useContributePotFlow> } }) {
    let done: Promise<unknown> | undefined
    act(() => {
        done = rendered.result.current.executeContribution()
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
const errorShown = () => (ctx.setError as jest.Mock).mock.calls.some(([e]) => (e as { showError: boolean }).showError)
const broadcastThenFail = async (_to: string, _amount: string, opts: { onBroadcast?: (b: unknown) => void }) => {
    opts.onBroadcast?.({ via: 'wallet', userOp: OP })
    throw markSpendMayHaveBroadcast(new Error('bundler request timed out'))
}

beforeEach(() => {
    jest.useFakeTimers()
    jest.clearAllMocks()
    window.localStorage.clear()
    resetCtx()
    Object.assign(ctx, {
        currentView: 'INITIAL',
        isLoading: false,
        setIsPaymentStatusUnknown: jest.fn(),
        isExternalWalletPayment: false,
    })
    mockCreateCharge.mockReset().mockResolvedValue(openCharge())
    mockFetchCharge.mockReset().mockResolvedValue(openCharge())
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

it('trace 1: a 5xx on recording after a mined contribution goes to recovery, never to a retry', async () => {
    mockRecordPayment.mockRejectedValue(new Error('Internal Server Error'))
    const rendered = render()
    const { done } = await tap(rendered)
    expect(rendered.result.current.isLoading).toBe(true)
    expect(errorShown()).toBe(false)
    await act(async () => {
        await rendered.result.current.executeContribution()
    })
    expect(mockCreateCharge).toHaveBeenCalledTimes(1)
    expect(mockSendMoney).toHaveBeenCalledTimes(1)

    await advance(65_000, done)
    expect(mockRecordPayment).toHaveBeenLastCalledWith(expect.objectContaining({ txHash: '0xmined' }))
    expect(ctx.setCurrentView).toHaveBeenLastCalledWith('STATUS')
    expect(ctx.setIsSuccess).not.toHaveBeenCalledWith(true)
    expect(errorShown()).toBe(false)
    expect(mockSendMoney).toHaveBeenCalledTimes(1)
})

it('trace 2: a send failure after the broadcast goes to recovery, with no second send', async () => {
    mockSendMoney.mockImplementation(broadcastThenFail)
    mockReadUserOpOutcome.mockResolvedValueOnce('unknown').mockResolvedValue({ executed: '0xfound' })
    mockFetchCharge
        .mockResolvedValueOnce(openCharge())
        .mockResolvedValueOnce(openCharge())
        .mockResolvedValue(openCharge('COMPLETED'))
    const rendered = render()
    const { done } = await tap(rendered)
    expect(errorShown()).toBe(false)
    await act(async () => {
        await rendered.result.current.executeContribution()
    })
    expect(mockSendMoney).toHaveBeenCalledTimes(1)

    await advance(10_000, done)
    expect(mockRecordPayment).toHaveBeenCalledWith(expect.objectContaining({ txHash: '0xfound' }))
    expect(ctx.setIsSuccess).toHaveBeenLastCalledWith(true)
    expect(mockSendMoney).toHaveBeenCalledTimes(1)
    expect(window.localStorage.getItem(MARKER_KEY)).toBeNull()
})

it('trace 3: a reload with a pending marker resumes recovery and keeps paying off', async () => {
    window.localStorage.setItem(
        MARKER_KEY,
        JSON.stringify({ chargeId: 'charge-1', startedAt: Date.now(), userOps: [OP], backendBroadcast: false })
    )
    const rendered = render()
    await advance(0)
    expect(rendered.result.current.isLoading).toBe(true)
    expect(mockFetchCharge).toHaveBeenCalledWith('charge-1')
    await act(async () => {
        await rendered.result.current.executeContribution()
    })
    expect(mockCreateCharge).not.toHaveBeenCalled()
    expect(mockSendMoney).not.toHaveBeenCalled()
})
