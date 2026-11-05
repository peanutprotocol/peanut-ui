import { reportInvalidNumeric, type NumericCategory } from './numeric-telemetry'

declare const finiteNumberBrand: unique symbol
declare const decimalAmountBrand: unique symbol
declare const moneyBrand: unique symbol
export type FiniteNumber = number & { readonly [finiteNumberBrand]: true }
export type DecimalAmount = string & { readonly [decimalAmountBrand]: true }
export type Money = Readonly<{
    amount: DecimalAmount
    currency: string
    decimals: number
    minorUnits: bigint
    [moneyBrand]: true
}>

const RAW_DECIMAL = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/
const MAX_UINT256 = (1n << 256n) - 1n
// Bound input parsing and bigint work, including otherwise-finite strings made
// arbitrarily large with leading/trailing zeros. This is a work budget, not a
// payment-value limit; uint256 and asset precision remain separate constraints.
export const MAX_RAW_AMOUNT_LENGTH = 1024
// Existing registry spellings outside the regular identifier grammar. Keeping
// these few explicit exceptions avoids importing the full registry into UI code.
const registryUnitExceptions = new Set(['1INCH', 'USD+', 'USDT+', 'W'])

/** Currency codes and registry asset symbols, including bridged USDC.e. */
export function isMoneyUnit(value: unknown): value is string {
    return (
        typeof value === 'string' &&
        (registryUnitExceptions.has(value) || /^[A-Za-z][A-Za-z0-9]{1,11}(?:\.[A-Za-z0-9]{1,8})?$/.test(value))
    )
}

function invalidCategory(value: unknown): NumericCategory {
    if (typeof value === 'string' && value.length > MAX_RAW_AMOUNT_LENGTH) return 'overflow'
    if (value === null || value === undefined || (typeof value === 'string' && value.trim() === '')) return 'missing'
    if (typeof value === 'number' && !Number.isFinite(value)) return 'nonfinite'
    if (typeof value === 'string' && /^(?:NaN|[+-]?Infinity)$/.test(value.trim())) return 'nonfinite'
    if (typeof value === 'string' && RAW_DECIMAL.test(value.trim()) && !Number.isFinite(Number(value)))
        return 'overflow'
    return 'malformed'
}

function readFinite(value: unknown): FiniteNumber | null {
    if (typeof value === 'string' && value.length > MAX_RAW_AMOUNT_LENGTH) return null
    if (typeof value !== 'number' && (typeof value !== 'string' || !RAW_DECIMAL.test(value.trim()))) return null
    const parsed = typeof value === 'number' ? value : Number(value.trim())
    return Number.isFinite(parsed) ? (parsed as FiniteNumber) : null
}

/** Raw values only: localized/grouped strings are display output, never money input. */
export function parseFiniteNumber(value: unknown): FiniteNumber | null {
    const parsed = readFinite(value)
    if (parsed === null) reportInvalidNumeric('money', invalidCategory(value))
    return parsed
}

export function parsePositiveRate(value: unknown): FiniteNumber | null {
    const parsed = readFinite(value)
    if (parsed === null || parsed <= 0) {
        reportInvalidNumeric('rate', parsed === null ? invalidCategory(value) : 'nonpositive')
        return null
    }
    return parsed
}

// JS numeric literals may stringify in exponent form. Expand that representation
// without rounding or a locale formatter; exponent strings from APIs stay invalid.
function rawNumber(value: number): string {
    const text = String(value)
    if (!/[eE]/.test(text)) return text
    const [mantissa, exponent] = text.toLowerCase().split('e')
    const [whole, fraction = ''] = mantissa.split('.')
    const digits = whole + fraction
    const point = whole.length + Number(exponent)
    if (point <= 0) return `0.${'0'.repeat(-point)}${digits}`
    if (point >= digits.length) return digits + '0'.repeat(point - digits.length)
    return `${digits.slice(0, point)}.${digits.slice(point)}`
}

/** Exact nonnegative money, with explicit units and supported precision. */
export function createMoney(raw: unknown, currency: string, decimals: number): Money | null {
    if (!isMoneyUnit(currency)) {
        reportInvalidNumeric('money', 'unit')
        return null
    }
    if (!Number.isInteger(decimals) || decimals < 0 || decimals > 36) {
        reportInvalidNumeric('money', 'precision')
        return null
    }
    const value = readFinite(raw)
    if (value === null || value < 0) {
        reportInvalidNumeric('money', value === null ? invalidCategory(raw) : 'nonpositive')
        return null
    }
    const text = typeof raw === 'number' ? rawNumber(raw) : (raw as string).trim()
    if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(text)) {
        reportInvalidNumeric('money', 'malformed')
        return null
    }
    const [whole = '', fraction = ''] = text.split('.')
    if (/[1-9]/.test(fraction.slice(decimals))) {
        reportInvalidNumeric('money', 'precision')
        return null
    }
    const minorUnits = BigInt((whole || '0') + fraction.slice(0, decimals).padEnd(decimals, '0'))
    if (minorUnits > MAX_UINT256) {
        reportInvalidNumeric('money', 'overflow')
        return null
    }
    return Object.freeze({ amount: text as DecimalAmount, currency, decimals, minorUnits }) as Money
}

/** Validate before any optimistic update, network write or wallet signing. */
export function requirePaymentMoney(raw: unknown, currency: string, decimals: number): Money {
    const money = createMoney(raw, currency, decimals)
    if (!money || money.minorUnits <= 0n) {
        reportInvalidNumeric('submission', 'malformed')
        throw new Error('Invalid payment amount or currency')
    }
    return money
}

/** The result is unavailable if either rate or any arithmetic step is invalid. */
export function checkedConversion(amount: unknown, fromRate: unknown, toRate: unknown): FiniteNumber | null {
    const value = readFinite(amount)
    const from = parsePositiveRate(fromRate)
    const to = parsePositiveRate(toRate)
    if (value === null || value < 0 || from === null || to === null) return null
    const product = value * from
    const result = product / to
    if (!Number.isFinite(product) || !Number.isFinite(result) || (value > 0 && (product === 0 || result === 0))) {
        reportInvalidNumeric('money', 'overflow')
        return null
    }
    return result as FiniteNumber
}

/** A nonnegative decimal represented as an exact integer fraction. */
function decimalFraction(text: string): { numerator: bigint; denominator: bigint } {
    const [whole, fraction = ''] = text.split('.')
    return { numerator: BigInt((whole || '0') + fraction), denominator: 10n ** BigInt(fraction.length) }
}

/**
 * Convert raw decimal text without feeding localized labels or scaled binary
 * floats back into money. Round once, at the requested output precision.
 */
export function convertDecimalAmount(
    raw: string,
    fromRate: number,
    toRate: number,
    decimals: number,
    roundUp: boolean = false
): string | null {
    if (!Number.isInteger(decimals) || decimals < 0 || decimals > 36) {
        reportInvalidNumeric('money', 'precision')
        return null
    }
    if (
        typeof raw !== 'string' ||
        raw.length > MAX_RAW_AMOUNT_LENGTH ||
        readFinite(raw) === null ||
        !/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(raw.trim())
    ) {
        reportInvalidNumeric('money', invalidCategory(raw))
        return null
    }
    if (typeof fromRate !== 'number' || typeof toRate !== 'number') {
        reportInvalidNumeric('rate', 'malformed')
        return null
    }
    const from = parsePositiveRate(fromRate)
    const to = parsePositiveRate(toRate)
    if (from === null || to === null) return null
    const amount = decimalFraction(raw.trim())
    const fromFraction = decimalFraction(rawNumber(from))
    const toFraction = decimalFraction(rawNumber(to))
    const numerator = amount.numerator * fromFraction.numerator * toFraction.denominator * 10n ** BigInt(decimals)
    const denominator = amount.denominator * fromFraction.denominator * toFraction.numerator
    const minorUnits = roundUp ? (numerator + denominator - 1n) / denominator : numerator / denominator
    if (minorUnits > MAX_UINT256) {
        reportInvalidNumeric('money', 'overflow')
        return null
    }
    if (decimals === 0) return minorUnits.toString()
    const digits = minorUnits.toString().padStart(decimals + 1, '0')
    const fraction = digits.slice(-decimals).replace(/0+$/, '')
    const whole = digits.slice(0, -decimals)
    return fraction ? `${whole}.${fraction}` : whole
}
