import type { Address, BaseError, Client, Hash, TransactionReceipt } from 'viem'
import { getUserOperationError, type RpcUserOperation, type UserOperation } from 'viem/account-abstraction'
import { isAa24Error } from '@/utils/walletCredential.utils'

/**
 * What a failed UserOperation send or receipt wait means for a retry.
 * - already_known: the bundler already holds this exact operation; wait for it.
 * - nonce_used: the nonce is spent; this operation may be the one that spent it.
 * - signature_invalid: the validator rejected the signature (AA24). No retry helps.
 * - expired: the sponsorship or validity window closed; only a new signature helps.
 * - transient: timeouts, transport and bundler capacity failures; the same operation may succeed.
 * - terminal: anything else.
 */
export type UserOpFailureKind =
    | 'already_known'
    | 'nonce_used'
    | 'signature_invalid'
    | 'expired'
    | 'transient'
    | 'terminal'

const ALREADY_KNOWN = /already known|already in (?:the )?mempool|duplicate user ?op/i
const NONCE_USED = /(?:^|[^0-9a-z])aa25(?:[^0-9a-z]|$)|invalid (?:account )?nonce|nonce too low/i
const EXPIRED = /(?:^|[^0-9a-z])aa(?:22|32)(?:[^0-9a-z]|$)|expired or not due/i
const SIGNATURE_INVALID_NAMES = new Set(['UserOperationSignatureError'])
const TRANSIENT_NAMES = new Set([
    'WaitForUserOperationReceiptTimeoutError',
    'UserOperationReceiptNotFoundError',
    'TimeoutError',
    'HttpRequestError',
    'LimitExceededRpcError',
    'InternalRpcError',
    'ResourceUnavailableRpcError',
])
const TRANSIENT_MESSAGE =
    /timed? ?out|timeout|failed to fetch|fetch failed|load failed|network ?error|network request failed|socket hang up|econnreset|etimedout|service unavailable|bad gateway|gateway timeout|too many requests|rate limit|internal error|replacement underpriced|could not be included|try again/i
const TRANSIENT_STATUS = new Set([408, 425, 429, 500, 502, 503, 504])

interface ErrorLike {
    name?: unknown
    message?: unknown
    shortMessage?: unknown
    details?: unknown
    status?: unknown
    cause?: unknown
}

function errorChain(error: unknown): ErrorLike[] {
    const chain: ErrorLike[] = []
    let current: unknown = error
    while (current && typeof current === 'object' && chain.length < 8 && !chain.includes(current as ErrorLike)) {
        chain.push(current as ErrorLike)
        current = (current as ErrorLike).cause
    }
    return chain
}

// viem prints the whole request (calldata, signature) after the first line of `message`;
// the first line, the short message and the details carry the bundler's own words.
const textOf = (link: ErrorLike) =>
    [typeof link.message === 'string' ? link.message.split('\n')[0] : undefined, link.shortMessage, link.details]
        .filter((part): part is string => typeof part === 'string')
        .join(' | ')

export function userOpFailureKind(error: unknown): UserOpFailureKind {
    if (error instanceof UserOpSubmissionError) return error.kind
    const chain = errorChain(error)
    if (chain.length === 0) return 'terminal'
    const text = chain.map(textOf).join(' | ')
    if (
        chain.some(
            (link) =>
                isAa24Error(textOf(link)) || (typeof link.name === 'string' && SIGNATURE_INVALID_NAMES.has(link.name))
        )
    ) {
        return 'signature_invalid'
    }
    if (ALREADY_KNOWN.test(text)) return 'already_known'
    if (NONCE_USED.test(text)) return 'nonce_used'
    if (EXPIRED.test(text)) return 'expired'
    if (
        chain.some(
            (link) =>
                (typeof link.name === 'string' && TRANSIENT_NAMES.has(link.name)) ||
                (typeof link.status === 'number' && TRANSIENT_STATUS.has(link.status))
        ) ||
        TRANSIENT_MESSAGE.test(text)
    ) {
        return 'transient'
    }
    return 'terminal'
}

export interface SubmissionBudget {
    /** Sends of the same signed operation before the first acceptance. */
    sendAttempts: number
    /** Pause before each further send; the last entry repeats. */
    backoffMs: readonly number[]
    /** Receipt waits; between two, the same operation is sent again in case the bundler dropped it. */
    receiptWindows: number
    receiptWindowMs: number
    /** Wall clock for the whole submission. */
    totalMs: number
}

/** Final signup step: 3 sends (2 s, 5 s apart), then two 45 s receipt waits, 2 min in all. */
export const SIGNUP_TEST_TX_SUBMISSION: SubmissionBudget = {
    sendAttempts: 3,
    backoffMs: [2_000, 5_000],
    receiptWindows: 2,
    receiptWindowMs: 45_000,
    totalMs: 120_000,
}

export interface UserOpReceiptResult {
    success: boolean
    receipt: TransactionReceipt
}

export interface SubmissionDeps {
    /** Sends the already-signed operation, unchanged. Never prepares or signs. */
    send: () => Promise<Hash>
    waitForReceipt: (hash: Hash, timeoutMs: number) => Promise<UserOpReceiptResult>
    /** One receipt lookup: null when the bundler has none (yet). */
    getReceipt: (hash: Hash) => Promise<UserOpReceiptResult | null>
    /**
     * Whether the operation's nonce is spent on chain. Pass it only when any
     * operation at that nonce is as good as this one: "Already known" can mean
     * the bundler holds an earlier signature of the same operation, whose hash
     * differs, so only the nonce shows that one landed.
     */
    nonceSpent?: () => Promise<boolean>
    sleep?: (ms: number) => Promise<void>
    now?: () => number
}

export interface SubmissionOutcome {
    success: boolean
    /** Null when only the spent nonce showed that an equivalent operation landed. */
    receipt: TransactionReceipt | null
    userOpHash: Hash
    sends: number
    /** Failures the submission recovered from, in order. */
    recovered: UserOpFailureKind[]
}

export class UserOpSubmissionError extends Error {
    constructor(
        public readonly kind: UserOpFailureKind,
        public readonly userOpHash: Hash,
        public readonly sends: number,
        public readonly accepted: boolean,
        cause: unknown
    ) {
        super(`UserOperation submission failed (${kind})`)
        this.name = 'UserOpSubmissionError'
        this.cause = cause
    }
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/**
 * Submits ONE signed UserOperation within a budget. Every send repeats the exact
 * same operation (same nonce, gas, paymaster data and signature), so retries can
 * never produce a second operation that could also land: the bundler either
 * accepts it, already holds it, or reports its nonce as spent, in which case the
 * receipt of this very hash decides.
 */
export async function submitSignedUserOperation(
    userOpHash: Hash,
    deps: SubmissionDeps,
    budget: SubmissionBudget = SIGNUP_TEST_TX_SUBMISSION
): Promise<SubmissionOutcome> {
    const sleep = deps.sleep ?? defaultSleep
    const now = deps.now ?? Date.now
    const deadline = now() + budget.totalMs
    const recovered: UserOpFailureKind[] = []
    let sends = 0
    let hash = userOpHash
    let accepted = false

    const fail = (kind: UserOpFailureKind, cause: unknown): never => {
        throw new UserOpSubmissionError(kind, hash, sends, accepted, cause)
    }

    const landedAtNonce = async (): Promise<Pick<SubmissionOutcome, 'success' | 'receipt'> | null> =>
        deps.nonceSpent && (await deps.nonceSpent().catch(() => false)) ? { success: true, receipt: null } : null

    const spentByThisOperation = async (cause: unknown): Promise<Pick<SubmissionOutcome, 'success' | 'receipt'>> => {
        const receipt = (await deps.getReceipt(hash).catch(() => null)) ?? (await landedAtNonce())
        return receipt ?? fail('nonce_used', cause)
    }

    /** One send; resolves to a receipt only when the nonce turned out to be spent by this operation. */
    const sendOnce = async (): Promise<Pick<SubmissionOutcome, 'success' | 'receipt'> | null> => {
        sends++
        try {
            const returned = await deps.send()
            // The bundler's hash is authoritative should it ever differ from the one computed locally.
            if (typeof returned === 'string' && returned.toLowerCase() !== hash.toLowerCase()) hash = returned
            accepted = true
            return null
        } catch (error) {
            const kind = userOpFailureKind(error)
            if (kind === 'already_known') {
                accepted = true
                recovered.push(kind)
                return null
            }
            if (kind === 'nonce_used') {
                const receipt = await spentByThisOperation(error)
                recovered.push(kind)
                return receipt
            }
            throw error
        }
    }

    for (let attempt = 1; !accepted; attempt++) {
        try {
            const receipt = await sendOnce()
            if (receipt) return { userOpHash: hash, ...receipt, sends, recovered }
        } catch (error) {
            if (error instanceof UserOpSubmissionError) throw error
            const kind = userOpFailureKind(error)
            const pause = budget.backoffMs[Math.min(attempt - 1, budget.backoffMs.length - 1)] ?? 0
            if (kind !== 'transient' || attempt >= budget.sendAttempts || now() + pause >= deadline) fail(kind, error)
            recovered.push(kind)
            await sleep(pause)
        }
    }

    let lastError: unknown
    for (let window = 1; window <= budget.receiptWindows; window++) {
        const remaining = deadline - now()
        if (remaining <= 0) break
        try {
            const receipt = await deps.waitForReceipt(hash, Math.min(budget.receiptWindowMs, remaining))
            return { userOpHash: hash, ...receipt, sends, recovered }
        } catch (error) {
            if (error instanceof UserOpSubmissionError) throw error
            lastError = error
            const kind = userOpFailureKind(error)
            if (kind !== 'transient') fail(kind, error)
            recovered.push(kind)
            const sibling = await landedAtNonce()
            if (sibling) return { userOpHash: hash, ...sibling, sends, recovered }
            if (window === budget.receiptWindows || now() >= deadline) break
            // A stalled bundler can drop the operation; the identical resend is a no-op when it still holds it.
            try {
                const receipt = await sendOnce()
                if (receipt) return { userOpHash: hash, ...receipt, sends, recovered }
            } catch (resendError) {
                if (resendError instanceof UserOpSubmissionError) throw resendError
                const resendKind = userOpFailureKind(resendError)
                if (resendKind !== 'transient') fail(resendKind, resendError)
            }
        }
    }
    const late = (await deps.getReceipt(hash).catch(() => null)) ?? (await landedAtNonce())
    if (late) return { userOpHash: hash, ...late, sends, recovered }
    return fail('transient', lastError)
}

/**
 * eth_sendUserOperation with an operation that is already prepared and signed,
 * exactly as stored. Errors take viem's usual shape (UserOperationExecutionError
 * with the bundler error as its cause), like a regular sendUserOperation.
 */
export async function sendSignedUserOperation(
    client: Pick<Client, 'request'>,
    userOperation: RpcUserOperation,
    entryPoint: Address
): Promise<Hash> {
    try {
        return (await client.request(
            { method: 'eth_sendUserOperation', params: [userOperation, entryPoint] } as never,
            { retryCount: 0 }
        )) as Hash
    } catch (error) {
        throw getUserOperationError(error as BaseError, userOperation as unknown as UserOperation)
    }
}
