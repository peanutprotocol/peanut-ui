import { parseFiniteNumber, parsePositiveRate } from './money'
import { reportInvalidNumeric } from './numeric-telemetry'

const amountFields = new Set([
    'amount',
    'tokenAmount',
    'usdAmount',
    'totalCollectedAmount',
    'totalBalance',
    'receivedAmount',
    'remainingAmount',
    'requestAmount',
    'netAmount',
    'fee',
    'balanceDue',
    'spendingPower',
    'minDepositLimitUsd',
    'maxDepositLimitUsd',
    'pendingUsd',
    'lifetimeUsd',
    'lifetimeEarnedUsd',
    'totalLifetimeEarnedUsd',
    'totalEarnedUsd',
])
const rateFields = new Set(['price', 'rate', 'netRate', 'grossRate', 'buy_rate', 'sell_rate', 'midmarket_rate'])

/** Validate raw numeric data without mutating or coercing its wire representation.
 * Optional nulls remain unavailable. Required fields belong to the owning decoder.
 */
export function validateNumericResponse<T>(value: T): T {
    const pending: { value: unknown; key: string; depth: number }[] = [{ value, key: '', depth: 0 }]
    const seen = new WeakSet<object>()
    let visited = 0
    const invalid = (category: 'malformed' | 'nonfinite' | 'overflow') => {
        reportInvalidNumeric('money', category)
        throw new Error('Numeric data is unavailable')
    }
    while (pending.length) {
        const item = pending.pop()!
        if (++visited > 100_000 || item.depth > 32) invalid('overflow')
        const current = item.value
        if (current === null || current === undefined) continue
        if (typeof current === 'number' && !Number.isFinite(current)) invalid('nonfinite')
        if (typeof current === 'object') {
            if (seen.has(current)) invalid('malformed')
            seen.add(current)
            for (const [key, child] of Object.entries(current)) {
                pending.push({ value: child, key, depth: item.depth + 1 })
                if (pending.length > 100_000) invalid('overflow')
            }
        } else if (rateFields.has(item.key)) {
            if (parsePositiveRate(current) === null) invalid('malformed')
        } else if (amountFields.has(item.key)) {
            if (parseFiniteNumber(current) === null) invalid('malformed')
        }
    }
    return value
}
