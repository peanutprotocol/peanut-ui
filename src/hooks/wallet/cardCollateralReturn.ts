import { encodeFunctionData, type Address, type Hash, type Hex, type TransactionReceipt } from 'viem'
import { findActiveCard } from '@/components/Card/cardState.utils'
import { rainCoordinatorAbi } from '@/constants/rain.consts'
import { API_ERROR_CODES, apiErrorStatus, wireErrorCode } from '@/services/api-error'
import {
    RainCooldownError,
    StaleCardApprovalError,
    type PrepareRainWithdrawalInput,
    type PrepareRainWithdrawalResponse,
    type RainCardOverview,
    type RainCardSummary,
    type RainWithdrawalStatus,
    type SubmitRainWithdrawalInput,
    type SubmitRainWithdrawalResponse,
} from '@/services/rain'
import { isRainBalanceKnown, rainCentsToUsdcUnits, usdcUnitsToRainCents } from '@/utils/balance.utils'
import { isUserCancellation as isDismissedPrompt } from '@/utils/rain-funding.utils'
import { toSubmitWithdrawalInput } from '@/utils/rainWithdraw.utils'
import { isUserOpRevertedError } from '@/utils/userop-rescue.utils'
import { isUserCancellation as isDismissedCeremony, sameAddress } from './spendPreflight'

const isUserCancellation = (e: unknown) => isDismissedCeremony(e) || isDismissedPrompt(e)

/**
 * Moves the card balance the provider says can be withdrawn back to the user's
 * own smart wallet. Used when managed card funding is set up (before any old
 * permission is retired) and by the card screen's "Move card balance to wallet".
 *
 * Every withdrawal carries a fresh passkey signature over the provider's admin
 * withdrawal. The old permissions' wider signing ability is never used, and no
 * new standing permission is installed. Two ways to send it:
 *  - `grant`: the card has a stored withdrawal permission, so the backend
 *    submits it (`/withdraw/submit`, waits for the receipt). One tap.
 *  - `root`: no stored permission, or its submission definitively failed. The wallet
 *    sends `withdrawAsset` itself with a root passkey UserOp and stamps the
 *    prepared record. Paid to the wallet (`directTransfer: false`), so the
 *    backend's draft sweep checks the chain for it. Two taps.
 *
 * The amount is the provider's `spendingPower` in whole cents (holds for
 * pending charges are already excluded; sub-cent dust stays), read fresh on
 * every attempt. An unreadable balance stops the attempt: unknown is not zero.
 *
 * An attempt whose outcome is not known is recorded per user and wallet (ids
 * and hashes only, never a signature; it survives a reload) and settled first
 * from its own evidence: the UserOp receipt, the backend's status for that
 * preparation, or (root, no receipt, signature expired) the backend's verified
 * cancel. A balance read, a signature expiry or an unrelated refusal alone is
 * never taken as proof that it did or did not happen.
 */

export type CollateralReturnFailure =
    /** The provider balance could not be read. Nothing was prepared. */
    | 'balance-unavailable'
    /** An earlier withdrawal may still move funds. Nothing else may be sent until it settles. */
    | 'pending'
    /** The provider refuses a new withdrawal for now. Nothing moved. */
    | 'cooldown'
    | 'cancelled'
    | 'account-changed'
    /** Another card signature or permission update is running. Nothing was sent. */
    | 'busy'
    /** Refused or reverted: nothing moved. A retry starts from a fresh read. */
    | 'failed'

export class CollateralReturnError extends Error {
    constructor(
        readonly kind: CollateralReturnFailure,
        readonly retryAfterSec?: number,
        options?: { cause?: unknown }
    ) {
        super(`Card balance return: ${kind}`, options)
        this.name = 'CollateralReturnError'
    }
}

export type CollateralReturnOutcome =
    | { kind: 'nothing' }
    | { kind: 'returned'; via: 'grant' | 'root'; preparationId: string; txHash?: string }

/** A return whose outcome is not known yet. Ids and hashes only. */
export interface PendingReturn {
    via: 'grant' | 'root'
    preparationId: string
    /** Root only: the provider signature expiry (unix seconds). */
    expiresAt?: number
    /** Root only: the UserOp, once the bundler took it. */
    userOpHash?: Hash
    /** Root only: the mined transaction, kept until the backend has it. */
    txHash?: Hash
}

interface StoredReturnState {
    op?: PendingReturn
    /** The stored permission was stale or its submission definitively failed: use root. */
    rootOnly?: true
}

type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

const STORAGE_PREFIX = 'peanut.cardCollateralReturn.v1:'
const HASH = /^0x[0-9a-fA-F]{64}$/

const parseStored = (raw: string | null): StoredReturnState => {
    if (!raw) return {}
    try {
        const value = JSON.parse(raw) as StoredReturnState
        const op = value.op
        const validOp =
            !!op &&
            (op.via === 'grant' || op.via === 'root') &&
            typeof op.preparationId === 'string' &&
            op.preparationId.length > 0 &&
            (op.expiresAt === undefined || Number.isSafeInteger(op.expiresAt)) &&
            (op.userOpHash === undefined || HASH.test(op.userOpHash)) &&
            (op.txHash === undefined || HASH.test(op.txHash))
        return {
            ...(validOp
                ? {
                      op: {
                          via: op.via,
                          preparationId: op.preparationId,
                          ...(op.expiresAt !== undefined ? { expiresAt: op.expiresAt } : {}),
                          ...(op.userOpHash ? { userOpHash: op.userOpHash } : {}),
                          ...(op.txHash ? { txHash: op.txHash } : {}),
                      },
                  }
                : {}),
            ...(value.rootOnly === true ? { rootOnly: true as const } : {}),
        }
    } catch {
        return {}
    }
}

/**
 * Returns whose outcome is not known, and the one running, per user and
 * wallet. Kept in local storage so a reload still settles them; kept in memory
 * too, so a storage failure never loses one within the session.
 */
export class PendingCollateralReturns {
    private readonly memory = new Map<string, StoredReturnState>()
    private readonly running = new Map<string, Promise<CollateralReturnOutcome>>()

    constructor(private readonly storage: () => KeyValueStorage | undefined = defaultStorage) {}

    // Storage first (another tab may have written), memory when it cannot be used.
    private read(owner: string): StoredReturnState {
        try {
            const storage = this.storage()
            if (storage) {
                const stored = parseStored(storage.getItem(STORAGE_PREFIX + owner))
                // A record this session could not persist still counts.
                const unsaved = this.memory.get(owner)
                return unsaved ? { ...stored, ...unsaved } : stored
            }
        } catch {
            // unreadable storage: memory only
        }
        return this.memory.get(owner) ?? {}
    }

    private write(owner: string, state: StoredReturnState) {
        try {
            const storage = this.storage()
            if (storage) {
                if (!state.op && !state.rootOnly) storage.removeItem(STORAGE_PREFIX + owner)
                else storage.setItem(STORAGE_PREFIX + owner, JSON.stringify(state))
                this.memory.delete(owner)
                return
            }
        } catch {
            // kept in memory below for this session
        }
        this.memory.set(owner, state)
    }

    get(owner: string): PendingReturn | undefined {
        return this.read(owner).op
    }
    set(owner: string, op: PendingReturn) {
        this.write(owner, { ...this.read(owner), op })
    }
    settle(owner: string) {
        const state = { ...this.read(owner) }
        delete state.op
        this.write(owner, state)
    }
    isRootOnly(owner: string): boolean {
        return this.read(owner).rootOnly === true
    }
    markRootOnly(owner: string) {
        this.write(owner, { ...this.read(owner), rootOnly: true })
    }
    /** One return per owner at a time: a second caller joins the first. */
    runExclusive(owner: string, run: () => Promise<CollateralReturnOutcome>): Promise<CollateralReturnOutcome> {
        const current = this.running.get(owner)
        if (current) return current
        const promise = run().finally(() => this.running.delete(owner))
        this.running.set(owner, promise)
        return promise
    }
}

function defaultStorage(): KeyValueStorage | undefined {
    return typeof window === 'undefined' ? undefined : window.localStorage
}

export const pendingCollateralReturns = new PendingCollateralReturns()

export const collateralReturnOwner = (userId: string, wallet: string) => `${userId}:${wallet.toLowerCase()}`

/** The path a return takes for this card: the stored permission unless it was refused before. */
export const collateralReturnPath = (
    pending: PendingCollateralReturns,
    owner: string,
    card: Pick<RainCardSummary, 'hasWithdrawApproval'> | null | undefined
): 'grant' | 'root' => (card?.hasWithdrawApproval === true && !pending.isRootOnly(owner) ? 'grant' : 'root')

export interface CollateralReturnDeps {
    /** User id and wallet: returns are recorded per owner. */
    owner: string
    wallet: Address
    chainId: number
    pending: PendingCollateralReturns
    /** Fresh provider overview. Must reject when the read failed. */
    readOverview: () => Promise<RainCardOverview>
    prepare: (input: PrepareRainWithdrawalInput) => Promise<PrepareRainWithdrawalResponse>
    submit: (input: SubmitRainWithdrawalInput) => Promise<SubmitRainWithdrawalResponse>
    stamp: (input: { preparationId: string; txHash: string }) => Promise<void>
    /** The backend's status for one preparation. Must reject when the read failed. */
    readStatus: (preparationId: string) => Promise<RainWithdrawalStatus>
    /** Best-effort back-out of a draft nothing was sent for. */
    cancelPreparation: (preparationId: string) => void
    /** The backend's verified cancel (expiry and chain check first). Must reject on any refusal. */
    cancelVerified: (preparationId: string) => Promise<void>
    /** Before a root send: the root-validator migration gate (it may prompt). */
    readyRootPath: (overview: RainCardOverview) => Promise<void>
    /** The passkey signature over the provider's admin withdrawal. */
    signAdmin: (prep: PrepareRainWithdrawalResponse) => Promise<Hex>
    sendRootUserOp: (
        calls: { to: Hex; value: bigint; data: Hex }[],
        onBroadcastAttempt: () => void
    ) => Promise<{ userOpHash: Hash; receipt: TransactionReceipt | null }>
    findUserOpReceipt: (userOpHash: Hash) => Promise<{ success: boolean; receipt: TransactionReceipt } | null>
    /** True once the account or wallet changed: nothing further may be sent. */
    isChanged: () => boolean
    /** Right before the first prompt of a return that has something to move. */
    onStart?: () => void
    nowMs?: () => number
}

/**
 * Reads a failed FIRST `/withdraw/submit` of a new preparation. Only the
 * backend's documented refusals before the send, and a confirmed revert, count
 * as no effect. Anything else may have been sent.
 */
function readFirstSubmitFailure(e: unknown): 'no-effect' | 'unknown' {
    const code = wireErrorCode(e)
    const status = apiErrorStatus(e)
    if (e instanceof StaleCardApprovalError || code === API_ERROR_CODES.STALE_CARD_APPROVAL) return 'no-effect'
    if (status === 409 && code === API_ERROR_CODES.RAIN_CONTROLLER_CHANGED) return 'no-effect'
    if (status === 410 && code === API_ERROR_CODES.WITHDRAWAL_SIGNATURE_EXPIRED) return 'no-effect'
    // Refused by the bundler, or reverted on chain: nothing moved.
    if (status === 502 && code === API_ERROR_CODES.WITHDRAWAL_SUBMISSION_FAILED) return 'no-effect'
    return 'unknown'
}

function prepareFailure(e: unknown): CollateralReturnError {
    if (e instanceof RainCooldownError) return new CollateralReturnError('cooldown', e.retryAfterSec ?? undefined)
    const code = wireErrorCode(e)
    if (code === API_ERROR_CODES.WITHDRAWAL_COOLDOWN_ACTIVE || code === API_ERROR_CODES.WITHDRAWAL_SIGNATURE_COOLDOWN) {
        return new CollateralReturnError('cooldown', undefined, { cause: e })
    }
    // The backend holds a withdrawal for this user that has not settled.
    if (code === API_ERROR_CODES.WITHDRAWAL_PENDING_CONFIRMATION) {
        return new CollateralReturnError('pending', undefined, { cause: e })
    }
    return new CollateralReturnError('failed', undefined, { cause: e })
}

/** Matches the API's signature-expiry margin for prepared withdrawals. */
const SIGNATURE_EXPIRY_MARGIN_SEC = 5 * 60

const stopIfChanged = (deps: CollateralReturnDeps) => {
    if (deps.isChanged()) throw new CollateralReturnError('account-changed')
}

/** The backend's status for a preparation. A failed read is never an answer. */
async function readStatus(deps: CollateralReturnDeps, preparationId: string): Promise<RainWithdrawalStatus> {
    stopIfChanged(deps)
    let status: RainWithdrawalStatus
    try {
        status = await deps.readStatus(preparationId)
    } catch (e) {
        throw new CollateralReturnError('pending', undefined, { cause: e })
    }
    stopIfChanged(deps)
    return status
}

/**
 * Records a mined root return with the backend. The local receipt proves funds
 * moved; the return settles once the backend holds that same hash. The hash is
 * recorded locally first, and a failed or lost stamp answer is resolved from
 * the status read: only the same hash on record settles it. A different hash,
 * or a finished preparation without it, stays pending for support.
 */
async function stampReturned(deps: CollateralReturnDeps, preparationId: string, txHash: Hash) {
    stopIfChanged(deps)
    try {
        await deps.stamp({ preparationId, txHash })
    } catch (e) {
        const status = await readStatus(deps, preparationId)
        if (!sameHash(status.txHash, txHash)) throw new CollateralReturnError('pending', undefined, { cause: e })
    }
    deps.pending.settle(deps.owner)
}

/**
 * A root return with no receipt: only the backend's verified cancellation
 * settles it. The cancel route refuses until the provider signature has
 * expired (plus margin), and before cancelling it checks the chain for the
 * movement. It is asked only after that window, and only a cancelled status
 * read back afterwards counts. Any refusal or failed check stays pending.
 */
async function settleByVerifiedCancel(
    deps: CollateralReturnDeps,
    earlier: PendingReturn,
    status: RainWithdrawalStatus
): Promise<null> {
    const expiresAt = status.expiresAt ?? earlier.expiresAt
    const nowSec = Math.floor((deps.nowMs ?? Date.now)() / 1000)
    if (expiresAt == null || nowSec <= expiresAt + SIGNATURE_EXPIRY_MARGIN_SEC) {
        throw new CollateralReturnError('pending')
    }
    // Evidence on record (held, confirming, conflict) is never cancelled.
    if (status.state === 'pending' && status.reason !== 'not_submitted') throw new CollateralReturnError('pending')
    stopIfChanged(deps)
    try {
        await deps.cancelVerified(earlier.preparationId)
    } catch (e) {
        throw new CollateralReturnError('pending', undefined, { cause: e })
    }
    const after = await readStatus(deps, earlier.preparationId)
    if (after.state !== 'cancelled') throw new CollateralReturnError('pending')
    deps.pending.settle(deps.owner)
    return null
}

/** Settles an earlier return whose outcome was not known. Null: it moved nothing, start fresh. */
async function settleEarlier(
    deps: CollateralReturnDeps,
    earlier: PendingReturn
): Promise<CollateralReturnOutcome | null> {
    const { preparationId } = earlier
    const returned = (txHash?: string | null): CollateralReturnOutcome => ({
        kind: 'returned',
        via: earlier.via,
        preparationId,
        ...(txHash ? { txHash } : {}),
    })

    // Backend-submitted: the backend holds every piece of evidence, so its
    // terminal answer is final.
    if (earlier.via === 'grant') {
        const status = await readStatus(deps, preparationId)
        if (status.state === 'completed') {
            deps.pending.settle(deps.owner)
            return returned(status.txHash)
        }
        if (status.state === 'failed' || status.state === 'cancelled') {
            deps.pending.settle(deps.owner)
            return null
        }
        throw new CollateralReturnError('pending')
    }

    // Root: this wallet broadcast it, and the backend may not know the
    // transaction. Only a receipt, or a receipt-backed completion, settles it.
    let txHash = earlier.txHash
    if (!txHash && earlier.userOpHash) {
        const found = await deps.findUserOpReceipt(earlier.userOpHash).catch(() => null)
        stopIfChanged(deps)
        // A mined revert is proof that nothing moved.
        if (found && !found.success) {
            deps.pending.settle(deps.owner)
            return null
        }
        if (found) {
            txHash = found.receipt.transactionHash
            deps.pending.set(deps.owner, { ...earlier, txHash })
        }
    }

    const status = await readStatus(deps, preparationId)
    if (!txHash) {
        if (status.state === 'completed') {
            deps.pending.settle(deps.owner)
            return returned(status.txHash)
        }
        return settleByVerifiedCancel(deps, earlier, status)
    }
    // Mined. Already recorded: done. Nothing recorded yet: stamp it.
    if (sameHash(status.txHash, txHash)) {
        deps.pending.settle(deps.owner)
        return returned(txHash)
    }
    if (status.state === 'pending' && status.reason === 'not_submitted' && !status.txHash) {
        await stampReturned(deps, preparationId, txHash)
        return returned(txHash)
    }
    // A different hash, or a finished preparation without this one: support.
    throw new CollateralReturnError('pending')
}

const sameHash = (a: string | null | undefined, b: string | null | undefined) =>
    !!a && !!b && a.toLowerCase() === b.toLowerCase()

export async function returnCardCollateral(deps: CollateralReturnDeps): Promise<CollateralReturnOutcome> {
    stopIfChanged(deps)
    const earlier = deps.pending.get(deps.owner)
    if (earlier) {
        const settled = await settleEarlier(deps, earlier)
        if (settled) return settled
    }
    stopIfChanged(deps)

    let overview: RainCardOverview
    try {
        overview = await deps.readOverview()
    } catch (e) {
        throw new CollateralReturnError('balance-unavailable', undefined, { cause: e })
    }
    stopIfChanged(deps)
    // A cached fallback figure is not a fresh provider read either.
    if (!isRainBalanceKnown(overview) || overview.balanceUnavailable) {
        throw new CollateralReturnError('balance-unavailable')
    }
    if (!overview.balance) return { kind: 'nothing' }

    const amountUnits = rainCentsToUsdcUnits(overview.balance.spendingPower)
    if (amountUnits <= 0n) return { kind: 'nothing' }
    const amountCents = usdcUnitsToRainCents(amountUnits).toString()
    const via = collateralReturnPath(deps.pending, deps.owner, findActiveCard(overview))

    deps.onStart?.()
    if (via === 'root') {
        try {
            await deps.readyRootPath(overview)
        } catch (e) {
            if (e instanceof CollateralReturnError) throw e
            throw new CollateralReturnError(isUserCancellation(e) ? 'cancelled' : 'failed', undefined, { cause: e })
        }
        stopIfChanged(deps)
    }

    let prep: PrepareRainWithdrawalResponse
    try {
        prep = await deps.prepare(
            via === 'grant'
                ? { amount: amountCents, recipientAddress: deps.wallet, directTransfer: true }
                : {
                      amount: amountCents,
                      recipientAddress: deps.wallet,
                      directTransfer: false,
                      totalAmountCents: amountCents,
                  }
        )
    } catch (e) {
        throw prepareFailure(e)
    }
    // Every exit below that sends nothing backs the draft out.
    const giveUp = (kind: CollateralReturnFailure, cause?: unknown): never => {
        deps.cancelPreparation(prep.preparationId)
        throw new CollateralReturnError(kind, undefined, { cause })
    }
    if (deps.isChanged()) giveUp('account-changed')
    // The prepared withdrawal must be the one asked for: this wallet, this
    // path, and no more than the fresh provider balance.
    const preparedUnits = BigInt(prep.amount)
    if (
        !sameAddress(prep.recipientAddress, deps.wallet) ||
        (via === 'root' && !sameAddress(prep.adminAddress, deps.wallet)) ||
        prep.directTransfer !== (via === 'grant') ||
        preparedUnits <= 0n ||
        preparedUnits > amountUnits
    ) {
        giveUp('failed')
    }

    let adminSignature: Hex
    try {
        adminSignature = await deps.signAdmin(prep)
    } catch (e) {
        return giveUp(isUserCancellation(e) ? 'cancelled' : 'failed', e)
    }
    if (deps.isChanged()) giveUp('account-changed')

    if (via === 'grant') {
        deps.pending.set(deps.owner, { via, preparationId: prep.preparationId })
        try {
            const { txHash } = await deps.submit(toSubmitWithdrawalInput(prep, adminSignature))
            deps.pending.settle(deps.owner)
            return { kind: 'returned', via, preparationId: prep.preparationId, txHash }
        } catch (e) {
            if (readFirstSubmitFailure(e) === 'unknown') {
                throw new CollateralReturnError('pending', undefined, { cause: e })
            }
            deps.pending.settle(deps.owner)
            // A stored grant can be unusable without a stale-approval response.
            // After a proven no-send or revert, let the next explicit retry use
            // root instead. Expiry and controller changes keep the grant path.
            if (
                e instanceof StaleCardApprovalError ||
                wireErrorCode(e) === API_ERROR_CODES.STALE_CARD_APPROVAL ||
                (apiErrorStatus(e) === 502 && wireErrorCode(e) === API_ERROR_CODES.WITHDRAWAL_SUBMISSION_FAILED)
            ) {
                deps.pending.markRootOnly(deps.owner)
            }
            throw new CollateralReturnError('failed', undefined, { cause: e })
        }
    }

    const withdrawCall = {
        to: prep.coordinatorAddress as Hex,
        value: 0n,
        data: encodeFunctionData({
            abi: rainCoordinatorAbi,
            functionName: 'withdrawAsset',
            args: [
                prep.collateralProxy as Address,
                prep.tokenAddress as Address,
                preparedUnits,
                prep.recipientAddress as Address,
                BigInt(prep.expiresAt),
                prep.executorSalt as Hex,
                prep.executorSignature as Hex,
                [prep.adminSalt as Hex],
                [adminSignature],
                prep.directTransfer,
            ],
        }),
    }
    // Recorded at the broadcast itself: a passkey prompt dismissed or a reload
    // before it leaves nothing that could have moved funds.
    let broadcastAttempted = false
    let sent: { userOpHash: Hash; receipt: TransactionReceipt | null }
    try {
        sent = await deps.sendRootUserOp([withdrawCall], () => {
            broadcastAttempted = true
            deps.pending.set(deps.owner, { via, preparationId: prep.preparationId, expiresAt: prep.expiresAt })
        })
    } catch (e) {
        if (!broadcastAttempted) return giveUp(isUserCancellation(e) ? 'cancelled' : 'failed', e)
        // A receipt that reported the revert proves nothing moved.
        if (isUserOpRevertedError(e)) {
            deps.pending.settle(deps.owner)
            throw new CollateralReturnError('failed', undefined, { cause: e })
        }
        throw new CollateralReturnError('pending', undefined, { cause: e })
    }
    // Hashes are recorded before the stamp, so a lost stamp is retried, never re-sent.
    const txHash = sent.receipt?.transactionHash
    deps.pending.set(deps.owner, {
        via,
        preparationId: prep.preparationId,
        expiresAt: prep.expiresAt,
        userOpHash: sent.userOpHash,
        ...(txHash ? { txHash } : {}),
    })
    if (!txHash) throw new CollateralReturnError('pending')
    await stampReturned(deps, prep.preparationId, txHash)
    return { kind: 'returned', via, preparationId: prep.preparationId, txHash }
}
