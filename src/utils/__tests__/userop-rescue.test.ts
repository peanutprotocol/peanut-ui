import { rescueUserOpReceipt, type UserOpReceiptWaiter } from '../userop-rescue.utils'
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
