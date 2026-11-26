/**
 * TASK-24270: a send link's deposit index must come from the chain, never a
 * guess. On 2026-10-31 the receipt wait timed out, the fallback read the
 * vault's deposit count as a bigint, and POST /send-links rejected it, so a
 * funded 5 USDC link never reached the sender's history.
 */
import type { UserOpReceiptWaiter } from '@/utils/userop-rescue.utils'
import { isUserOpRevertedError } from '@/utils/userop-rescue.utils'
import { LinkDepositUnconfirmedError, parseLinkDeposit, resolveLinkDeposit } from '@/utils/send-link-deposit.utils'
import { createChainBundlerClient } from '@/utils/bundler-client.utils'
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
jest.mock('@/utils/bundler-client.utils', () => ({ createChainBundlerClient: jest.fn() }))

const mockBundler = createChainBundlerClient as jest.MockedFunction<typeof createChainBundlerClient>
const mockDemo = isDemoMode as jest.MockedFunction<typeof isDemoMode>

const PUB_KEY = '0x899B65fd3660F09D1504392A705a9f003316edDe' as const
const base = { chainId: 42161, vault: VAULT, sender: SENDER, pubKey: PUB_KEY, userOpHash: USEROP_HASH }

function bundlerAnswering(result: Awaited<ReturnType<UserOpReceiptWaiter['waitForUserOperationReceipt']>> | null) {
    const waitForUserOperationReceipt = jest.fn(async () => {
        if (!result) throw new Error('Timed out while waiting for User Operation')
        return result
    })
    mockBundler.mockReturnValue({ waitForUserOperationReceipt } as unknown as ReturnType<
        typeof createChainBundlerClient
    >)
    return waitForUserOperationReceipt
}

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
        const deposit = await resolveLinkDeposit({ ...base, receipt: receiptWith([depositLog({ index: 589n })]) })
        expect(deposit).toEqual({ depositIdx: 589, txHash: TX_HASH })
        expect(mockBundler).not.toHaveBeenCalled()
    })

    test('after a receipt timeout, waits on the userOp hash and reads the late receipt', async () => {
        const wait = bundlerAnswering({ success: true, receipt: receiptWith([depositLog({ index: 589n })]) })
        const deposit = await resolveLinkDeposit({ ...base, receipt: null })
        expect(deposit).toEqual({ depositIdx: 589, txHash: TX_HASH })
        expect(mockBundler).toHaveBeenCalledWith(42161)
        expect(wait).toHaveBeenCalledWith(expect.objectContaining({ hash: USEROP_HASH, timeout: 120_000 }))
    })

    test('no late receipt: fails with the ids support needs, never a guessed index', async () => {
        bundlerAnswering(null)
        const error = await resolveLinkDeposit({ ...base, receipt: null }).catch((e: unknown) => e)
        expect(error).toBeInstanceOf(LinkDepositUnconfirmedError)
        expect(error).toMatchObject({ name: 'LinkDepositUnconfirmedError', pubKey: PUB_KEY, userOpHash: USEROP_HASH })
    })

    test('a late receipt of a reverted op fails as a revert: no money moved', async () => {
        bundlerAnswering({ success: false, receipt: receiptWith([]) })
        const error = await resolveLinkDeposit({ ...base, receipt: null }).catch((e: unknown) => e)
        expect(isUserOpRevertedError(error)).toBe(true)
    })

    test('demo mode never waits on a chain', async () => {
        mockDemo.mockReturnValue(true)
        const deposit = await resolveLinkDeposit({ ...base, receipt: null })
        expect(deposit.depositIdx).toBe(0)
        expect(mockBundler).not.toHaveBeenCalled()
    })
})
