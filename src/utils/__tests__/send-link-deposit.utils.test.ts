/**
 * TASK-24270: a send link's deposit index must come from the chain, never a
 * guess. On 2026-10-31 the receipt wait timed out, the fallback read the
 * vault's deposit count as a bigint, and POST /send-links rejected it, so a
 * funded 5 USDC link never reached the sender's history.
 */
import type { UserOpReceiptWaiter } from '@/utils/userop-rescue.utils'
import { isUserOpRevertedError } from '@/utils/userop-rescue.utils'
import {
    LINK_DEPOSIT_LATE_RECEIPT_TIMEOUT_MS,
    LinkDepositUnconfirmedError,
    parseLinkDeposit,
    resolveLinkDeposit,
} from '@/utils/send-link-deposit.utils'
import { isDemoMode } from '@/utils/demo'
import {
    OTHER_SENDER,
    SENDER,
    TX_HASH,
    USEROP_HASH,
    VAULT,
    depositLog,
    receiptWith,
} from './send-link-deposit.fixtures'

jest.mock('posthog-js', () => ({ capture: jest.fn() }))
jest.mock('@/utils/demo', () => ({ isDemoMode: jest.fn(() => false) }))

const mockDemo = isDemoMode as jest.MockedFunction<typeof isDemoMode>

const PUB_KEY = '0x899B65fd3660F09D1504392A705a9f003316edDe' as const
type LateReceipt = Awaited<ReturnType<UserOpReceiptWaiter['waitForUserOperationReceipt']>>

/** viem's own error when the wait runs out. */
const receiptTimeout = () =>
    Object.assign(new Error('Timed out while waiting for User Operation'), {
        name: 'WaitForUserOperationReceiptTimeoutError',
    })

/** A bundler that answers each wait in turn: a receipt, or an error to throw. */
function bundler(...answers: (LateReceipt | Error)[]) {
    const waitForUserOperationReceipt = jest.fn(async () => {
        const answer = answers.shift() ?? receiptTimeout()
        if (answer instanceof Error) throw answer
        return answer
    })
    return { waitForUserOperationReceipt }
}

const base = { vault: VAULT, sender: SENDER, pubKey: PUB_KEY, userOpHash: USEROP_HASH }

beforeEach(() => {
    jest.clearAllMocks()
    mockDemo.mockReturnValue(false)
})

describe('parseLinkDeposit', () => {
    test('returns the index as a JSON-safe number and the transaction hash', () => {
        const deposit = parseLinkDeposit(receiptWith([depositLog({ index: 589n })]), { vault: VAULT, sender: SENDER })
        expect(deposit).toEqual({ depositIdx: 589, txHash: TX_HASH })
        expect(JSON.stringify(deposit)).toContain('"depositIdx":589')
    })

    test('ignores other userOps in the same bundle and lookalike events from other contracts', () => {
        const receipt = receiptWith([
            depositLog({ index: 588n, sender: OTHER_SENDER }),
            depositLog({ index: 7n, address: '0x2222222222222222222222222222222222222222' }),
            depositLog({ index: 589n }),
        ])
        expect(parseLinkDeposit(receipt, { vault: VAULT, sender: SENDER }).depositIdx).toBe(589)
    })

    test('throws when the receipt holds no deposit from this sender', () => {
        const receipt = receiptWith([depositLog({ index: 588n, sender: OTHER_SENDER })])
        expect(() => parseLinkDeposit(receipt, { vault: VAULT, sender: SENDER })).toThrow(/No vault DepositEvent/)
    })
})

describe('resolveLinkDeposit', () => {
    test('reads the deposit from the send receipt without a second wait', async () => {
        const waiter = bundler()
        const deposit = await resolveLinkDeposit({
            ...base,
            receipt: receiptWith([depositLog({ index: 589n })]),
            receiptWaiter: () => waiter,
        })
        expect(deposit).toEqual({ depositIdx: 589, txHash: TX_HASH })
        expect(waiter.waitForUserOperationReceipt).not.toHaveBeenCalled()
    })

    test('after a receipt timeout, waits on the userOp hash and reads the late receipt', async () => {
        const waiter = bundler({ success: true, receipt: receiptWith([depositLog({ index: 589n })]) })
        const deposit = await resolveLinkDeposit({ ...base, receipt: null, receiptWaiter: () => waiter })
        expect(deposit).toEqual({ depositIdx: 589, txHash: TX_HASH })
        expect(waiter.waitForUserOperationReceipt).toHaveBeenCalledWith({
            hash: USEROP_HASH,
            timeout: expect.any(Number),
        })
        const [{ timeout }] = waiter.waitForUserOperationReceipt.mock.calls[0] as unknown as [{ timeout: number }]
        expect(timeout).toBeLessThanOrEqual(LINK_DEPOSIT_LATE_RECEIPT_TIMEOUT_MS)
    })

    test('a transient RPC error does not end the extra wait', async () => {
        jest.useFakeTimers()
        const waiter = bundler(new Error('HTTP request failed. Status: 502'), {
            success: true,
            receipt: receiptWith([depositLog({ index: 589n })]),
        })
        const pending = resolveLinkDeposit({ ...base, receipt: null, receiptWaiter: () => waiter })
        await jest.advanceTimersByTimeAsync(1_000)
        await expect(pending).resolves.toEqual({ depositIdx: 589, txHash: TX_HASH })
        expect(waiter.waitForUserOperationReceipt).toHaveBeenCalledTimes(2)
        jest.useRealTimers()
    })

    test('no late receipt: fails with the ids support needs, never a guessed index', async () => {
        const error = await resolveLinkDeposit({ ...base, receipt: null, receiptWaiter: () => bundler() }).catch(
            (e: unknown) => e
        )
        expect(error).toBeInstanceOf(LinkDepositUnconfirmedError)
        expect(error).toMatchObject({ name: 'LinkDepositUnconfirmedError', pubKey: PUB_KEY, userOpHash: USEROP_HASH })
    })

    test('a late receipt of a reverted op fails as a revert: no money moved', async () => {
        const waiter = bundler({ success: false, receipt: receiptWith([]) })
        const error = await resolveLinkDeposit({ ...base, receipt: null, receiptWaiter: () => waiter }).catch(
            (e: unknown) => e
        )
        expect(isUserOpRevertedError(error)).toBe(true)
    })

    test('demo mode never waits on a chain', async () => {
        mockDemo.mockReturnValue(true)
        const receiptWaiter = jest.fn(() => bundler())
        const deposit = await resolveLinkDeposit({ ...base, receipt: null, receiptWaiter })
        expect(deposit.depositIdx).toBe(0)
        expect(receiptWaiter).not.toHaveBeenCalled()
    })
})
