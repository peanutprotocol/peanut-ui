import type { MoneriumPreparedWithdrawal, MoneriumWithdrawInput } from '@/services/monerium'
import type { Hex } from 'viem'

export type MoneriumWithdrawalAttempt = MoneriumWithdrawInput & {
    prepared?: MoneriumPreparedWithdrawal
    signature?: Hex
    submitAttempted?: boolean
    operationId?: string
}
const prefix = 'monerium-withdrawal:'
const attempts = new Map<string, MoneriumWithdrawalAttempt>()

export function readMoneriumWithdrawal(userId: string): MoneriumWithdrawalAttempt | null {
    if (attempts.has(userId)) return attempts.get(userId)!
    try {
        const raw = localStorage.getItem(`${prefix}${userId}`)
        if (!raw) return null
        const value = JSON.parse(raw) as MoneriumWithdrawalAttempt
        if (
            !value ||
            typeof value.requestKey !== 'string' ||
            !/^[0-9a-f-]{36}$/i.test(value.requestKey) ||
            typeof value.amount !== 'string' ||
            !moneriumEuroAmount(value.amount) ||
            typeof value.externalAccountId !== 'string'
        )
            return null
        if (
            value.prepared &&
            (typeof value.prepared.operationId !== 'string' ||
                typeof value.prepared.message !== 'string' ||
                value.prepared.status !== 'READY')
        )
            return null
        if (value.signature && (!value.prepared || !/^0x[0-9a-f]+$/i.test(value.signature))) return null
        attempts.set(userId, value)
        return value
    } catch {
        return null
    }
}

export function storeMoneriumWithdrawal(userId: string, attempt: MoneriumWithdrawalAttempt) {
    attempts.set(userId, attempt)
    try {
        localStorage.setItem(`${prefix}${userId}`, JSON.stringify(attempt))
    } catch {
        // Retain recovery in memory when device storage is unavailable.
    }
}

export function clearMoneriumWithdrawal(userId: string, operationId?: string) {
    const attempt = readMoneriumWithdrawal(userId)
    if (operationId && (attempt?.prepared?.operationId ?? attempt?.operationId) !== operationId) return
    attempts.delete(userId)
    try {
        localStorage.removeItem(`${prefix}${userId}`)
    } catch {
        /* Logout remains available. */
    }
}

export function restoreMoneriumWithdrawal(
    userId: string,
    operation: {
        id: string
        status: string
        amount: string
        requestKey?: string
        externalAccountId?: string | null
    }
): boolean {
    if (operation.status !== 'READY') return false
    const existing = readMoneriumWithdrawal(userId)
    if ((existing?.prepared?.operationId ?? existing?.operationId) === operation.id) return true
    const amount = moneriumEuroAmount(operation.amount)
    if (
        !amount ||
        !operation.requestKey ||
        !/^[0-9a-f-]{36}$/i.test(operation.requestKey) ||
        !operation.externalAccountId
    )
        return false
    storeMoneriumWithdrawal(userId, {
        requestKey: operation.requestKey,
        amount,
        externalAccountId: operation.externalAccountId,
        operationId: operation.id,
    })
    return true
}

export function moneriumEuroAmount(input: string): string | null {
    const normalized = input.trim().replace(',', '.')
    if (!/^\d{1,18}(?:\.\d{1,2})?$/.test(normalized)) return null
    const [whole, fraction = ''] = normalized.split('.')
    if (BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0')) <= 0n) return null
    return `${BigInt(whole)}.${fraction.padEnd(2, '0')}`
}

export const moneriumOperationFinal = (status: string) =>
    ['COMPLETED', 'FAILED', 'CANCELLED', 'NEEDS_REVIEW'].includes(status)
