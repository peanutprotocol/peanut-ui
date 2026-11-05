import type { Address, Hash } from 'viem'
import type { RpcUserOperation } from 'viem/account-abstraction'
import { readStoredValue, removeStoredValue, writeStoredValue } from '@/utils/safe-storage'
import type { PasskeySignatureRejection } from '@/utils/webauthn-userop-signature'

export type SignatureCheckOutcome = 'valid' | PasskeySignatureRejection | 'unverifiable'
const SIGNATURE_CHECKS: readonly SignatureCheckOutcome[] = [
    'valid',
    'unverifiable',
    'malformed',
    'flags',
    'type',
    'challenge',
    'high_s',
    'signature',
]

/** Transient failures of the final signup step after which the person may finish without the confirmation. */
export const DEFERRAL_AFTER_TRANSIENT_FAILURES = 2
/** Later automatic resends of a deferred confirmation, one per app start. */
export const DEFERRED_RETRY_LIMIT = 5
const MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000

/**
 * The final signup step's signed test operation, kept on the device from the
 * moment it is signed. A reload, a retry or the later automatic retry resends
 * this exact operation instead of preparing and signing a new one, so the
 * person is not asked for the passkey again and no second operation can exist.
 */
export interface SignupTestTransaction {
    chainId: number
    sender: Address
    entryPoint: Address
    userOpHash: Hash
    userOperation: RpcUserOperation
    /** The deployed validator's checks run on the device: 'valid', the first check that failed, or 'unverifiable'. */
    signatureCheck: SignatureCheckOutcome
    /** The bundler or the device check rejected the signature: never deferrable. */
    signatureRejected: boolean
    /** The operation can no longer be included; the next attempt must sign again. */
    needsNewSignature: boolean
    transientFailures: number
    mined: boolean
    /** The person finished signup before the operation was confirmed. */
    deferred: boolean
    deferredRetries: number
    signedAt: number
}

interface Stored extends SignupTestTransaction {
    version: 1
}

const keyFor = (userId: string) => `peanut:signupTestTx:${userId}`
const HASH = /^0x[0-9a-f]{64}$/i
const ADDRESS = /^0x[0-9a-f]{40}$/i
const HEX = /^0x[0-9a-f]*$/i

function isRpcUserOperation(value: unknown): value is RpcUserOperation {
    if (!value || typeof value !== 'object') return false
    const op = value as Record<string, unknown>
    return (
        typeof op.sender === 'string' &&
        ADDRESS.test(op.sender) &&
        ['nonce', 'callData', 'signature'].every((key) => typeof op[key] === 'string' && HEX.test(op[key] as string)) &&
        Object.values(op).every((field) => field === undefined || field === null || typeof field === 'string')
    )
}

export function readSignupTestTransaction(userId: string, now = Date.now()): SignupTestTransaction | null {
    const raw = readStoredValue(keyFor(userId))
    if (!raw) return null
    try {
        const stored = JSON.parse(raw) as Partial<Stored>
        if (
            stored.version !== 1 ||
            typeof stored.chainId !== 'number' ||
            typeof stored.sender !== 'string' ||
            !ADDRESS.test(stored.sender) ||
            typeof stored.entryPoint !== 'string' ||
            !ADDRESS.test(stored.entryPoint) ||
            typeof stored.userOpHash !== 'string' ||
            !HASH.test(stored.userOpHash) ||
            !isRpcUserOperation(stored.userOperation) ||
            typeof stored.signedAt !== 'number' ||
            now - stored.signedAt > MAX_AGE_MS
        ) {
            removeStoredValue(keyFor(userId))
            return null
        }
        const count = (value: unknown) => (typeof value === 'number' && value >= 0 ? Math.floor(value) : 0)
        return {
            chainId: stored.chainId,
            sender: stored.sender as Address,
            entryPoint: stored.entryPoint as Address,
            userOpHash: stored.userOpHash as Hash,
            userOperation: stored.userOperation,
            signatureCheck: SIGNATURE_CHECKS.includes(stored.signatureCheck as SignatureCheckOutcome)
                ? (stored.signatureCheck as SignatureCheckOutcome)
                : 'unverifiable',
            signatureRejected: stored.signatureRejected === true,
            needsNewSignature: stored.needsNewSignature === true,
            transientFailures: count(stored.transientFailures),
            mined: stored.mined === true,
            deferred: stored.deferred === true,
            deferredRetries: count(stored.deferredRetries),
            signedAt: stored.signedAt,
        }
    } catch {
        removeStoredValue(keyFor(userId))
        return null
    }
}

export function saveSignupTestTransaction(userId: string, record: SignupTestTransaction): void {
    const stored: Stored = { version: 1, ...record }
    writeStoredValue(keyFor(userId), JSON.stringify(stored))
}

export function updateSignupTestTransaction(
    userId: string,
    patch: Partial<SignupTestTransaction>
): SignupTestTransaction | null {
    const current = readSignupTestTransaction(userId)
    if (!current) return null
    const next = { ...current, ...patch }
    saveSignupTestTransaction(userId, next)
    return next
}

export function clearSignupTestTransaction(userId: string): void {
    removeStoredValue(keyFor(userId))
}

/**
 * Finishing without the confirmation is offered only when the bundler, not the
 * passkey, is the problem: after repeated transient failures, and only for an
 * operation whose signature passed the validator's own checks on the device. A
 * signature the validator rejects (AA24) means an account that could receive
 * funds but never move them, so it is never deferrable.
 */
export function canDeferSignupTestTransaction(record: SignupTestTransaction | null): boolean {
    return (
        !!record &&
        !record.mined &&
        record.signatureCheck === 'valid' &&
        !record.signatureRejected &&
        !record.needsNewSignature &&
        record.transientFailures >= DEFERRAL_AFTER_TRANSIENT_FAILURES
    )
}
