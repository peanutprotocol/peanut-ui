import type { Address, Hash, TransactionReceipt } from 'viem'
import { isAddressEqual, parseEventLogs } from 'viem'
import { isDemoMode } from '@/utils/demo'
import { getFromLocalStorage, saveToLocalStorage } from '@/utils/general.utils'
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

const UNCONFIRMED_LINK_KEY = 'sendLink::unconfirmed'

/**
 * A link-create op with no receipt yet. It stays on the device until the
 * chain settles it, so a retry cannot fund a second link while the first can
 * still land (Chip on ui#4296). The password stays under `sendLinkPasswordKey`.
 */
export interface UnconfirmedLink {
    userOpHash: Hash
    pubKey: Address
    sender: Address
    chainId: string
    contractVersion: string
    tokenAddress: Address
    /** Token units, as a decimal string. */
    amount: string
    preparationId?: string
    message?: string
}

export const unconfirmedLinkStore = {
    save: (link: UnconfirmedLink) => saveToLocalStorage(UNCONFIRMED_LINK_KEY, link),
    /** Another account's record on the same device never blocks this one. */
    read: (sender: Address): UnconfirmedLink | null => {
        const link = getFromLocalStorage(UNCONFIRMED_LINK_KEY) as UnconfirmedLink | null | undefined
        return link && isAddressEqual(link.sender, sender) ? link : null
    },
    clear: () => {
        if (typeof localStorage !== 'undefined') localStorage.removeItem(UNCONFIRMED_LINK_KEY)
    },
}

/** The bundler calls that tell what became of an op. */
export interface UserOpLookup {
    getUserOperationReceipt(args: { hash: Hash }): Promise<{ success: boolean; receipt: TransactionReceipt }>
    getUserOperation(args: { hash: Hash }): Promise<unknown>
}

export type UserOpFate =
    | { state: 'landed'; receipt: TransactionReceipt }
    | { state: 'reverted' | 'pending' | 'dropped' }

const nullWhen = (name: string) => (error: unknown) => {
    if ((error as Error)?.name === name) return null
    throw error
}

/**
 * What became of an op, as the bundler knows it. A receipt means it ran. No
 * receipt but a known op means it still waits. Neither means the bundler
 * dropped it, so it can no longer land. Any other RPC error propagates: the
 * caller then fails before it signs anything new.
 */
export async function readUserOpFate(client: UserOpLookup, hash: Hash): Promise<UserOpFate> {
    const ran = await client.getUserOperationReceipt({ hash }).catch(nullWhen('UserOperationReceiptNotFoundError'))
    if (ran) return ran.success ? { state: 'landed', receipt: ran.receipt } : { state: 'reverted' }
    const queued = await client.getUserOperation({ hash }).catch(nullWhen('UserOperationNotFoundError'))
    return { state: queued ? 'pending' : 'dropped' }
}
