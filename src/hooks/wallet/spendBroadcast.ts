import type { Hash, Hex } from 'viem'
import { getUserOperationHash, type SmartAccount, type UserOperation } from 'viem/account-abstraction'
import { API_ERROR_CODES, apiErrorStatus, wireErrorCode } from '@/services/api-error'
import { userOpFailureKind } from '@/utils/userop-submission'
import { isStaleKeyError } from '@/utils/walletCredential.utils'

/**
 * A user op this device signed and is about to hand to the bundler: enough to
 * find out later, from the chain, whether it executed. Saved before the
 * broadcast, so a reload in the middle of a send can still answer that.
 */
export interface BroadcastUserOp {
    userOpHash: Hash
    /** The op's nonce as a decimal string: the marker is stored as JSON. */
    nonce: string
}

/**
 * One send leaving this device: a user op handed to the bundler (`userOp` is
 * null when its hash could not be computed), or the backend asked to broadcast
 * from the card balance.
 */
export type SpendBroadcast = { via: 'wallet'; userOp: BroadcastUserOp | null } | { via: 'backend' }

/**
 * Describes a signed op for {@link BroadcastUserOp}. Null when the hash cannot
 * be computed: the send goes on, and recovery then waits on the charge alone.
 */
export function describeSignedUserOp(
    account: {
        address: SmartAccount['address']
        entryPoint: Pick<SmartAccount['entryPoint'], 'address' | 'version'>
    },
    chainId: number,
    preparedOp: object,
    signature: Hex
): BroadcastUserOp | null {
    try {
        const userOperation = { ...preparedOp, sender: account.address, signature } as UserOperation
        return {
            userOpHash: getUserOperationHash({
                chainId,
                entryPointAddress: account.entryPoint.address,
                entryPointVersion: account.entryPoint.version,
                userOperation,
            }),
            nonce: userOperation.nonce.toString(),
        }
    } catch {
        return null
    }
}

/**
 * Tags a spend failure that happened after the send left this device: the
 * money may have moved with the answer lost. The original error is kept, so
 * every existing check on its type, name or message still holds (the same
 * pattern as `userOpRevertedError`).
 */
export function markSpendMayHaveBroadcast(error: unknown): Error {
    const tagged = error instanceof Error ? error : new Error(String(error))
    return Object.assign(tagged, { spendMayHaveBroadcast: true as const })
}

export function spendMayHaveBroadcast(error: unknown): boolean {
    return (
        !!error &&
        typeof error === 'object' &&
        (error as { spendMayHaveBroadcast?: unknown }).spendMayHaveBroadcast === true
    )
}

function bundlerAnswered(error: unknown): boolean {
    let current: unknown = error
    for (let depth = 0; current && typeof current === 'object' && depth < 8; depth++) {
        const link = current as { name?: unknown; code?: unknown; cause?: unknown }
        if (link.name === 'RpcRequestError' || typeof link.code === 'number') return true
        current = link.cause
    }
    return false
}

/**
 * The answers of peanut-api-ts `POST /rain/cards/withdraw/submit` that prove
 * it refused before it sent: a payload or session it refuses (400, 401, 403),
 * an unknown or out-of-date preparation (404, 410), and the two 409 codes of
 * a refusal before the send. Any other 4xx may hide a send the backend
 * accepted: a 408 is a timeout, a 409 WITHDRAWAL_PENDING_CONFIRMATION says
 * the send is confirming, and a 409 without a code can be "already completed".
 */
const REFUSED_BEFORE_SEND_STATUSES = new Set([400, 401, 403, 404, 410])
const REFUSED_BEFORE_SEND_CONFLICTS = new Set<string>([
    API_ERROR_CODES.STALE_CARD_APPROVAL,
    API_ERROR_CODES.RAIN_CONTROLLER_CHANGED,
])

/**
 * True when whoever was asked to send answered "no" to the send itself, so
 * nothing was accepted: the bundler rejected the op (signature, validity
 * window or another validation error it named), or the backend refused the
 * card-balance broadcast before sending it. A timeout, a dropped connection,
 * a 5xx or "already known" is not a refusal: the op may still execute.
 */
export function isDefinitiveSendRefusal(error: unknown): boolean {
    if (isStaleKeyError(error)) return true
    const code = wireErrorCode(error)
    if (code !== undefined && REFUSED_BEFORE_SEND_CONFLICTS.has(code)) return true
    const status = apiErrorStatus(error)
    if (status !== undefined) {
        return REFUSED_BEFORE_SEND_STATUSES.has(status)
    }
    const kind = userOpFailureKind(error)
    if (kind === 'signature_invalid' || kind === 'expired') return true
    return kind === 'terminal' && bundlerAnswered(error)
}
