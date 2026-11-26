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

    it('returns null (no telemetry) when the rescue attempt also fails', async () => {
        const rescued = await rescueUserOpReceipt(
            waiter(new Error('still down')),
            USEROP_HASH,
            new Error('blip'),
            'zerodev-send'
        )
        expect(rescued).toBeNull()
        expect(posthog.capture).not.toHaveBeenCalled()
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
        expect(spy).toHaveBeenCalledWith({ hash: USEROP_HASH, timeout: 120_000 })
        expect(posthog.capture).toHaveBeenCalledWith(
            'send_receipt_rescued',
            expect.objectContaining({ context: 'link-create' })
        )
    })

    it('returns null when the op still has no receipt', async () => {
        const rescued = await waitForUserOpReceiptOrNull(waiter(new Error('timed out')), USEROP_HASH, 'link-create', {
            timeoutMs: 120_000,
        })
        expect(rescued).toBeNull()
        expect(posthog.capture).not.toHaveBeenCalled()
    })
})
