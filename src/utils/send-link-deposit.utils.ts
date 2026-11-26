import type { Address, Hash, TransactionReceipt } from 'viem'
import { isAddressEqual, parseEventLogs } from 'viem'
import { isDemoMode } from '@/utils/demo'
import { peanutVaultAbi } from '@/utils/peanut-claim.utils'
import { userOpRevertedError, waitForUserOpReceiptOrNull, type UserOpReceiptWaiter } from '@/utils/userop-rescue.utils'

/**
 * Extra wait for a link's userOp after the send's own 120 s wait gave up.
 * Kept short: the screen is busy the whole time, and a person who closes the
 * app then leaves a funded link nobody recorded.
 */
export const LINK_DEPOSIT_LATE_RECEIPT_TIMEOUT_MS = 60_000

/** The vault slot that holds a send link's money. */
export interface LinkDeposit {
    depositIdx: number
    txHash: Hash
}

/**
 * No receipt came for the link's userOp, in the send's wait or in the extra
 * wait. The op can still land later, so a blind retry could fund a second
 * link. The pubKey and userOpHash let support find the deposit.
 */
export class LinkDepositUnconfirmedError extends Error {
    readonly pubKey: Address
    readonly userOpHash: Hash | undefined

    constructor(pubKey: Address, userOpHash: Hash | undefined) {
        super(`Send link deposit not confirmed (pubKey ${pubKey}, userOpHash ${userOpHash ?? 'none'})`)
        this.name = 'LinkDepositUnconfirmedError'
        this.pubKey = pubKey
        this.userOpHash = userOpHash
    }
}

/**
 * The deposit in a link-create receipt. The receipt is the whole bundle
 * transaction, which can carry other userOps, so only this vault's event from
 * this sender counts.
 */
export function parseLinkDeposit(
    receipt: TransactionReceipt,
    { vault, sender }: { vault: Address; sender: Address }
): LinkDeposit {
    const [event] = parseEventLogs({
        abi: peanutVaultAbi,
        eventName: 'DepositEvent',
        logs: receipt.logs,
        args: { _senderAddress: sender },
    }).filter((log) => isAddressEqual(log.address, vault))
    if (!event) throw new Error(`No vault DepositEvent from ${sender} in transaction ${receipt.transactionHash}`)
    return { depositIdx: Number(event.args._index), txHash: event.transactionHash }
}

/**
 * The deposit a link-create send made. A null receipt is the send's own wait
 * timing out (TASK-24270): wait once more on the userOp hash instead of
 * guessing the index, because a wrong index makes a link that cannot claim.
 */
export async function resolveLinkDeposit({
    receipt,
    userOpHash,
    receiptWaiter,
    vault,
    sender,
    pubKey,
}: {
    receipt: TransactionReceipt | null | undefined
    userOpHash: Hash | undefined
    /** A bundler client for the chain; any one finds the op by its hash.
     *  Read only when the receipt is missing. */
    receiptWaiter: () => UserOpReceiptWaiter
    vault: Address
    sender: Address
    pubKey: Address
}): Promise<LinkDeposit> {
    if (receipt) return parseLinkDeposit(receipt, { vault, sender })
    // Demo sends never touch the chain; the demo API serves slot 0.
    if (isDemoMode()) return { depositIdx: 0, txHash: userOpHash ?? `0x${'de'.repeat(32)}` }
    if (!userOpHash) throw new LinkDepositUnconfirmedError(pubKey, userOpHash)

    const late = await waitForUserOpReceiptOrNull(receiptWaiter(), userOpHash, 'link-create', {
        timeoutMs: LINK_DEPOSIT_LATE_RECEIPT_TIMEOUT_MS,
    })
    if (!late) throw new LinkDepositUnconfirmedError(pubKey, userOpHash)
    // A reverted op moved no money: fail like every other send path.
    if (!late.success) throw userOpRevertedError(userOpHash, late.success)
    return parseLinkDeposit(late.receipt, { vault, sender })
}
