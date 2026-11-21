/**
 * The shared double-send guard on its own, replaying the ChargeSendFlow.tla
 * traces (mono engineering/api/state-machines/ChargeSendFlow.tla): a second
 * tap in the same tick, and a lost answer after the send left this device,
 * for an order the flow books (a charge, a Bridge transfer) and for one its
 * owner books (a Manteca withdrawal the backend submits).
 */
import { act } from '@testing-library/react'
import { renderHookWithIntl } from '@/test-utils/intl'

jest.mock('@/context/authContext', () => ({ useAuth: () => ({ user: { user: { userId: 'u1' } } }) }))
const mockReadUserOpOutcome = jest.fn()
jest.mock('@/utils/userop-outcome', () => ({
    readUserOpOutcome: (...args: unknown[]) => mockReadUserOpOutcome(...args),
}))

import { usePendingChargeSend } from '../usePendingChargeSend'
import { markSpendMayHaveBroadcast } from '@/hooks/wallet/spendBroadcast'
import type { SendOrderRead } from '../../utils/pending-charge-send'

const WALLET = '0x2222222222222222222222222222222222222222'
const MARKER_KEY = 'peanut:pendingChargeSend:u1:withdraw:dest'
const OP = { userOpHash: `0x${'ab'.repeat(32)}` as `0x${string}`, nonce: '7' }

const readOrder = jest.fn<Promise<SendOrderRead>, unknown[]>()
const recordPayment = jest.fn<Promise<void>, unknown[]>()
const setters = {
    setIsSuccess: jest.fn(),
    setTxHash: jest.fn(),
    setIsPaymentStatusUnknown: jest.fn(),
    setCurrentView: jest.fn(),
    setError: jest.fn(),
}

function render({ books = true }: { books?: boolean } = {}) {
    return renderHookWithIntl(() =>
        usePendingChargeSend({
            intent: 'withdraw:dest',
            walletAddress: WALLET,
            readOrder,
            ...(books ? { recordPayment } : {}),
            canResume: true,
            ...setters,
        })
    )
}

beforeEach(() => {
    jest.useFakeTimers()
    jest.clearAllMocks()
    window.localStorage.clear()
    readOrder.mockReset().mockResolvedValue({ state: 'unbooked' })
    recordPayment.mockReset().mockResolvedValue(undefined)
    mockReadUserOpOutcome.mockReset().mockResolvedValue('unknown')
})
afterEach(() => {
    jest.clearAllTimers()
    jest.useRealTimers()
})

it('a second tap in the same tick claims nothing until the first attempt is released', () => {
    const { result, unmount } = render()
    let first = false
    let second = true
    act(() => {
        first = result.current.claim()
        second = result.current.claim()
    })
    expect(first).toBe(true)
    expect(second).toBe(false)
    act(() => result.current.release())
    expect(result.current.claim()).toBe(true)
    unmount()
})

it('a lost answer after the broadcast is read back from the chain and booked: no second send', async () => {
    const { result, unmount } = render()
    mockReadUserOpOutcome.mockResolvedValue({ executed: '0xfound' })
    let outcome: string | undefined
    await act(async () => {
        expect(result.current.claim()).toBe(true)
        result.current.begin('order-1')
        result.current.onBroadcast({ via: 'wallet', userOp: OP })
        const lost = markSpendMayHaveBroadcast(new Error('bundler request timed out'))
        expect(result.current.mayHaveSent(lost)).toBe(true)
        const recovery = result.current.recover()
        // the recovery holds the intent: a tap meanwhile starts nothing
        expect(result.current.claim()).toBe(false)
        outcome = await recovery
    })
    expect(outcome).toBe('completed')
    expect(mockReadUserOpOutcome).toHaveBeenCalledWith(OP, WALLET)
    expect(recordPayment).toHaveBeenCalledWith(expect.objectContaining({ chargeId: 'order-1' }), '0xfound')
    expect(setters.setIsSuccess).toHaveBeenLastCalledWith(true)
    expect(setters.setTxHash).toHaveBeenLastCalledWith('0xfound')
    expect(window.localStorage.getItem(MARKER_KEY)).toBeNull()
    unmount()
})

it('an order its owner books ends as sent while the owner settles it, and keeps the payment off', async () => {
    const { result, unmount } = render({ books: false })
    readOrder.mockResolvedValue({ state: 'settling', txHash: '0xcard' })
    let outcome: string | undefined
    await act(async () => {
        result.current.claim()
        result.current.begin('prep-1')
        result.current.onBroadcast({ via: 'backend' })
        const recovery = result.current.recover()
        await jest.advanceTimersByTimeAsync(65_000)
        outcome = await recovery
    })
    expect(outcome).toBe('sent')
    expect(recordPayment).not.toHaveBeenCalled()
    expect(setters.setIsPaymentStatusUnknown).toHaveBeenLastCalledWith(true)
    expect(setters.setError).not.toHaveBeenCalled()
    expect(window.localStorage.getItem(MARKER_KEY)).not.toBeNull()
    expect(result.current.isPending).toBe(true)
    unmount()
})

it('an order its owner books ends on success once the owner reports it completed', async () => {
    const { result, unmount } = render({ books: false })
    readOrder.mockResolvedValueOnce({ state: 'settling', txHash: '0xcard' }).mockResolvedValue({ state: 'completed' })
    let outcome: string | undefined
    await act(async () => {
        result.current.claim()
        result.current.begin('prep-1')
        result.current.onBroadcast({ via: 'backend' })
        const recovery = result.current.recover()
        await jest.advanceTimersByTimeAsync(3_000)
        outcome = await recovery
    })
    expect(outcome).toBe('completed')
    expect(setters.setIsSuccess).toHaveBeenLastCalledWith(true)
    expect(setters.setTxHash).toHaveBeenLastCalledWith('0xcard')
    expect(window.localStorage.getItem(MARKER_KEY)).toBeNull()
    unmount()
})

it('a backend broadcast its order closed moved nothing: the payment is offered again', async () => {
    const { result, unmount } = render({ books: false })
    readOrder.mockResolvedValue({ state: 'closed' })
    let outcome: string | undefined
    await act(async () => {
        result.current.claim()
        result.current.begin('prep-1')
        result.current.onBroadcast({ via: 'backend' })
        outcome = await result.current.recover()
    })
    expect(outcome).toBe('not-sent')
    expect(setters.setCurrentView).toHaveBeenLastCalledWith('INITIAL')
    expect(result.current.claim()).toBe(true)
    unmount()
})

it('a send still nowhere when the window ends keeps the payment off, and a revisit resumes it', async () => {
    const first = render()
    let outcome: string | undefined
    await act(async () => {
        first.result.current.claim()
        first.result.current.begin('order-1')
        first.result.current.onBroadcast({ via: 'wallet', userOp: OP })
        const recovery = first.result.current.recover()
        await jest.advanceTimersByTimeAsync(65_000)
        outcome = await recovery
    })
    expect(outcome).toBe('in-flight')
    expect(window.localStorage.getItem(MARKER_KEY)).not.toBeNull()
    expect(first.result.current.claim()).toBe(false)
    expect(first.result.current.isPending).toBe(true)
    first.unmount()

    // a reload: the marker resumes its recovery and the op is found
    mockReadUserOpOutcome.mockResolvedValue({ executed: '0xfound' })
    const second = render()
    await act(async () => {
        await jest.advanceTimersByTimeAsync(0)
    })
    expect(recordPayment).toHaveBeenCalledWith(expect.objectContaining({ chargeId: 'order-1' }), '0xfound')
    expect(setters.setIsSuccess).toHaveBeenLastCalledWith(true)
    second.unmount()
})
