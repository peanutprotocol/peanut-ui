import { pollForUserOpReceipt, type UserOpReceiptReader } from '../userop-receipt.utils'
import type { Hash, TransactionReceipt } from 'viem'

const USEROP_HASH = ('0x' + 'ab'.repeat(32)) as Hash
const RECEIPT = { transactionHash: ('0x' + 'cd'.repeat(32)) as Hash } as TransactionReceipt

function readerAvailableOnAttempt(n: number): { reader: UserOpReceiptReader; calls: () => number } {
    let calls = 0
    return {
        reader: {
            getUserOperationReceipt: async () => {
                calls++
                if (calls >= n) return { receipt: RECEIPT }
                throw new Error('UserOperationReceiptNotFoundError')
            },
        },
        calls: () => calls,
    }
}

describe('pollForUserOpReceipt', () => {
    beforeEach(() => jest.useFakeTimers())
    afterEach(() => jest.useRealTimers())

    // BEFORE this util existed (main): when waitForUserOperationReceipt gave
    // up, the send flow proceeded with receipt=null and recorded the userOp
    // hash as a tx hash — unresolvable by any RPC, so the backend burned its
    // full retry window and marked a SUCCESSFUL payment FAILED (11/mo in the
    // 28-day prod baseline). AFTER: a receipt that lands seconds later is
    // recovered and the real transaction hash is recorded.
    it('recovers a receipt that becomes available on a later poll', async () => {
        const { reader, calls } = readerAvailableOnAttempt(3)
        const promise = pollForUserOpReceipt(reader, USEROP_HASH, { attempts: 6, delayMs: 3000 })
        await jest.advanceTimersByTimeAsync(15_000)
        await expect(promise).resolves.toBe(RECEIPT)
        expect(calls()).toBe(3)
    })

    it('returns the receipt immediately when the first poll finds it', async () => {
        const { reader, calls } = readerAvailableOnAttempt(1)
        await expect(pollForUserOpReceipt(reader, USEROP_HASH)).resolves.toBe(RECEIPT)
        expect(calls()).toBe(1)
    })

    it('gives up with null after the attempt budget', async () => {
        const { reader, calls } = readerAvailableOnAttempt(Infinity)
        const promise = pollForUserOpReceipt(reader, USEROP_HASH, { attempts: 4, delayMs: 1000 })
        await jest.advanceTimersByTimeAsync(10_000)
        await expect(promise).resolves.toBeNull()
        expect(calls()).toBe(4)
    })

    it('treats a null result the same as not-found', async () => {
        const reader: UserOpReceiptReader = { getUserOperationReceipt: async () => null }
        const promise = pollForUserOpReceipt(reader, USEROP_HASH, { attempts: 2, delayMs: 500 })
        await jest.advanceTimersByTimeAsync(2_000)
        await expect(promise).resolves.toBeNull()
    })
})
