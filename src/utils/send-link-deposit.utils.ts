import type { Address, Hash, TransactionReceipt } from 'viem'
import { isAddressEqual, parseEventLogs } from 'viem'
import { isDemoMode } from '@/utils/demo'
import { getFromLocalStorage, saveToLocalStorage } from '@/utils/general.utils'
import { sendLinkPasswordKey } from '@/utils/peanut-link.utils'
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
 * The device would not store the link's password, so nothing is signed (Chip
 * on ui#4296). Without durable storage a restart loses both the password (the
 * sender could not open the link again) and the record that guards a retry
 * against a second deposit while the first can still land.
 */
export class LinkStorageUnavailableError extends Error {
    constructor() {
        super('The device refused to store the send link password')
        this.name = 'LinkStorageUnavailableError'
    }
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

/** One record per account, so accounts on a shared device never touch each other's. */
const unconfirmedLinkKey = (sender: Address) => `sendLink::unconfirmed::${sender.toLowerCase()}`

/**
 * How long a link op with no receipt blocks a new link. A missing receipt
 * proves nothing (ERC-4337 bundlers may answer null for an op still in the
 * mempool), so the block lifts only on a receipt or after this time. Bundlers
 * drop a stuck op long before it.
 */
export const UNCONFIRMED_LINK_BLOCK_MS = 60 * 60_000

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
    /** Epoch ms when the send came back without a receipt. */
    savedAt: number
}

/**
 * A copy for this app session, kept in memory only. createLink fails closed
 * when the password cannot be stored (LinkStorageUnavailableError); this covers
 * the rest: a record write that fails after the password write worked, so a
 * retry in this session is still guarded.
 */
const sessionCopies = new Map<string, { link: UnconfirmedLink; password: string }>()

export const unconfirmedLinkStore = {
    save: (link: UnconfirmedLink, password: string) => {
        sessionCopies.set(unconfirmedLinkKey(link.sender), { link, password })
        saveToLocalStorage(unconfirmedLinkKey(link.sender), link)
    },
    read: (sender: Address): UnconfirmedLink | null =>
        (getFromLocalStorage(unconfirmedLinkKey(sender)) as UnconfirmedLink | null | undefined) ??
        sessionCopies.get(unconfirmedLinkKey(sender))?.link ??
        null,
    /** The link's password: from storage, else from this session's copy. */
    password: (link: UnconfirmedLink): string | undefined =>
        (getFromLocalStorage(sendLinkPasswordKey(link.pubKey)) as string | null | undefined) ??
        sessionCopies.get(unconfirmedLinkKey(link.sender))?.password,
    clear: (sender: Address) => {
        sessionCopies.delete(unconfirmedLinkKey(sender))
        if (typeof localStorage !== 'undefined') localStorage.removeItem(unconfirmedLinkKey(sender))
    },
}

/** The bundler call that tells whether an op ran. */
export interface UserOpLookup {
    getUserOperationReceipt(args: { hash: Hash }): Promise<{ success: boolean; receipt: TransactionReceipt }>
}

export type UserOpFate = { state: 'landed'; receipt: TransactionReceipt } | { state: 'reverted' } | { state: 'unknown' }

/**
 * Whether an op ran, as its receipt shows. No receipt is `unknown`, never
 * "dropped": the op can still be in a mempool. Any other RPC error propagates,
 * so the caller fails before it signs anything new.
 */
export async function readUserOpFate(client: UserOpLookup, hash: Hash): Promise<UserOpFate> {
    const ran = await client.getUserOperationReceipt({ hash }).catch((error: unknown) => {
        if ((error as Error)?.name === 'UserOperationReceiptNotFoundError') return null
        throw error
    })
    if (!ran) return { state: 'unknown' }
    return ran.success ? { state: 'landed', receipt: ran.receipt } : { state: 'reverted' }
}
