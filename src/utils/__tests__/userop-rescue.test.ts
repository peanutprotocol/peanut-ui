import { rescueUserOpReceipt, waitForUserOpReceiptOrNull, type UserOpReceiptWaiter } from '../userop-rescue.utils'
import posthog from 'posthog-js'
import type { Hash, TransactionReceipt } from 'viem'

jest.mock('posthog-js', () => ({ capture: jest.fn() }))
jest.mock('@/utils/demo', () => ({ isDemoMode: jest.fn(() => false) }))

const USEROP_HASH = ('0x' + 'ab'.repeat(32)) as Hash
const RECEIPT = { transactionHash: ('0x' + 'cd'.repeat(32)) as Hash } as TransactionReceipt

function waiter(result: { success: boolean; receipt: TransactionReceipt } | Error): UserOpReceiptWaiter {
    return {
        waitForUserOperationReceipt: async () => {
            if (result instanceof Error) throw result
            return result
        },
    }
}

describe('rescueUserOpReceipt', () => {
    beforeEach(() => jest.clearAllMocks())

    it('rescues a successful receipt after a transient wait failure and captures telemetry', async () => {
        const rescued = await rescueUserOpReceipt(
            waiter({ success: true, receipt: RECEIPT }),
            USEROP_HASH,
            new Error('socket hang up'),
            'zerodev-send'
        )
        expect(rescued).toEqual({ success: true, receipt: RECEIPT })
        expect(posthog.capture).toHaveBeenCalledWith(
            'send_receipt_rescued',
            expect.objectContaining({ context: 'zerodev-send', reverted: false })
        )
    })

    it('returns the FULL receipt for a rescued-but-REVERTED op — the caller decides the failure mode', async () => {
        const rescued = await rescueUserOpReceipt(
            waiter({ success: false, receipt: RECEIPT }),
            USEROP_HASH,
            new Error('blip'),
            'mixed-ephemeral-spend'
        )
        expect(rescued).toEqual({ success: false, receipt: RECEIPT })
        expect(posthog.capture).toHaveBeenCalledWith(
            'send_receipt_rescued',
            expect.objectContaining({ reverted: true })
        )
    })

    it('skips the rescue entirely after a genuinely exhausted wait timeout', async () => {
        const timeoutError = new Error('timed out')
        timeoutError.name = 'WaitForUserOperationReceiptTimeoutError'
        const client = waiter({ success: true, receipt: RECEIPT })
        const spy = jest.spyOn(client, 'waitForUserOperationReceipt')
        const rescued = await rescueUserOpReceipt(client, USEROP_HASH, timeoutError, 'zerodev-send')
        expect(rescued).toBeNull()
        expect(spy).not.toHaveBeenCalled()
        expect(posthog.capture).not.toHaveBeenCalled()
    })

    it('returns null (no telemetry) when the bundler stays down until the cap', async () => {
        jest.useFakeTimers()
        const pending = rescueUserOpReceipt(
            waiter(new Error('still down')),
            USEROP_HASH,
            new Error('blip'),
            'zerodev-send'
        )
        await jest.advanceTimersByTimeAsync(15_000)
        expect(await pending).toBeNull()
        expect(posthog.capture).not.toHaveBeenCalled()
        jest.useRealTimers()
    })
})

// TASK-24270: a send link cannot finish without its receipt, and an op landed
// 7 s after the 120 s wait gave up — so this wait runs even after a timeout.
describe('waitForUserOpReceiptOrNull', () => {
    beforeEach(() => jest.clearAllMocks())

    it('waits even when the first wait timed out, and captures the rescue', async () => {
        const client = waiter({ success: true, receipt: RECEIPT })
        const spy = jest.spyOn(client, 'waitForUserOperationReceipt')
        const rescued = await waitForUserOpReceiptOrNull(client, USEROP_HASH, 'link-create', { timeoutMs: 120_000 })
        expect(rescued).toEqual({ success: true, receipt: RECEIPT })
        expect(spy).toHaveBeenCalledWith({ hash: USEROP_HASH, timeout: expect.any(Number) })
        expect(posthog.capture).toHaveBeenCalledWith(
            'send_receipt_rescued',
            expect.objectContaining({ context: 'link-create' })
        )
    })

    it('returns null when the wait runs out', async () => {
        const timeout = Object.assign(new Error('timed out'), { name: 'WaitForUserOperationReceiptTimeoutError' })
        const rescued = await waitForUserOpReceiptOrNull(waiter(timeout), USEROP_HASH, 'link-create', {
            timeoutMs: 120_000,
        })
        expect(rescued).toBeNull()
        expect(posthog.capture).not.toHaveBeenCalled()
    })

    // viem's wait rejects on the first RPC error that is not "receipt not
    // found"; one 502 must not end a wait that still has time left.
    it('asks again after a transient RPC error until the receipt arrives', async () => {
        jest.useFakeTimers()
        const answers: (Error | { success: boolean; receipt: TransactionReceipt })[] = [
            new Error('HTTP request failed. Status: 502'),
            { success: true, receipt: RECEIPT },
        ]
        const client: UserOpReceiptWaiter = {
            waitForUserOperationReceipt: jest.fn(async () => {
                const answer = answers.shift()!
                if (answer instanceof Error) throw answer
                return answer
            }),
        }
        const pending = waitForUserOpReceiptOrNull(client, USEROP_HASH, 'link-create', { timeoutMs: 60_000 })
        await jest.advanceTimersByTimeAsync(1_000)
        expect(await pending).toEqual({ success: true, receipt: RECEIPT })
        expect(client.waitForUserOperationReceipt).toHaveBeenCalledTimes(2)
        jest.useRealTimers()
    })

    // viem treats timeout 0 as "no timeout": a used-up deadline must not wait at all.
    it('never waits without a deadline', async () => {
        const client = waiter({ success: true, receipt: RECEIPT })
        const spy = jest.spyOn(client, 'waitForUserOperationReceipt')
        expect(await waitForUserOpReceiptOrNull(client, USEROP_HASH, 'link-create', { timeoutMs: 0 })).toBeNull()
        expect(spy).not.toHaveBeenCalled()
    })
})
