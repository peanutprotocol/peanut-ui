import { isMoneyUnit, parseFiniteNumber } from '@/lib/money'
import { reportInvalidNumeric } from '@/lib/numeric-telemetry'
import { SYMBOLS_BY_CURRENCY_CODE } from '@/constants/currency-symbols.consts'

// Helper function to get currency symbol based on code
export const getDisplayCurrencySymbol = (code?: string, fallbackSymbol: string = '$'): string => {
    if (!code) return fallbackSymbol
    const upperCode = code.toUpperCase()
    return SYMBOLS_BY_CURRENCY_CODE[upperCode] ?? upperCode
}

/**
 * A bank amount as people read it: "€2,000" or "€2,000.50" — no ".00" on a
 * round amount (design.md, copy). Rounds to the cent first, so 1999.999 is "€2,000".
 * `locale` sets the separators (see {@link formatAmountNumber}).
 */
export const formatBankAmount = (amount: string | number, currencyCode: string, locale: string = 'en-US'): string => {
    if (!isMoneyUnit(currencyCode)) {
        reportInvalidNumeric('format', 'unit')
        return '—'
    }
    const symbol = getDisplayCurrencySymbol(currencyCode)
    // A currency with no symbol of its own shows its code, which needs a space: "ARS 1,000", not "ARS1,000".
    const prefix = /^[A-Z]+$/.test(symbol) ? `${symbol} ` : symbol
    const formatted = formatAmountNumber(amount, 2, 2, locale)
    return formatted === '—' ? formatted : `${prefix}${formatted}`
}

/**
 * The number part of {@link formatBankAmount}: "2,000.50", "2,000", "0.10".
 * For a line that already carries its currency code ("≈ USD 0.10").
 *
 * This is the one place a money amount is rounded for display (design.md,
 * copy → amounts): half-up to `maxDecimals`, at least `minDecimals` digits
 * when there is a fraction, and no ".00" on a round amount. `formatCurrency`
 * and `formatNumberForDisplay` delegate here. A spendable balance is floored
 * to the cent before it gets here (`formatUsdcBalance`).
 *
 * `locale` sets the separators. Argentines and Brazilians read "1,746.62" as
 * 1.74, so a screen that shows pesos or reais passes the app locale ("1.746,62").
 * The default keeps every other caller in US format.
 */
export const formatAmountNumber = (
    amount: string | number,
    maxDecimals: number = 2,
    minDecimals: number = 2,
    locale: string = 'en-US'
): string => {
    const value = parseFiniteNumber(amount)
    if (value === null) {
        reportInvalidNumeric('format', 'malformed')
        return '—'
    }
    if (!validDecimals(maxDecimals) || !validDecimals(minDecimals)) {
        reportInvalidNumeric('format', 'precision')
        return '—'
    }
    const formatted = formatFiniteDisplay(value, locale, {
        minimumFractionDigits: Math.min(minDecimals, maxDecimals),
        maximumFractionDigits: maxDecimals,
        roundingMode: 'halfExpand',
    })
    if (formatted === '—') return formatted
    // no ".00" on a round amount, with the locale's own decimal mark (",00" in es-AR)
    return formatted.replace(new RegExp(`\\${decimalSeparator(locale)}0+$`), '')
}

const decimalSeparator = (locale: string): string =>
    new Intl.NumberFormat(locale).formatToParts(1.1).find((part) => part.type === 'decimal')?.value ?? '.'

/**
 * The number of a fiat exchange rate, as in "1 USD = 5.40 BRL": half-up to two
 * decimals and always both, so "5.40", never "5.4" or "4.941639". No fiat value
 * shows more than two decimals, and a rate counts (TASK-24947, 2026-11-15).
 * A token rate is not fiat and keeps its own precision.
 * `locale` sets the separators (see {@link formatAmountNumber}).
 */
export const formatFiatRate = (rate: string | number, locale: string = 'en-US'): string =>
    formatFiniteDisplay(rate, locale, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
        roundingMode: 'halfExpand',
    })

/**
 * `amount` rounded UP to `decimals`, as the server prices a charge: a local
 * amount converted to the USD that pays it (withdraw quote, request amount).
 */
export const roundUpToDecimals = (amount: number, decimals: number): number => {
    const factor = 10 ** decimals
    // Binary floating point puts an exact 8.29 just above 829 minor units, and
    // a bare ceil would then charge a cent nobody owes. Nine decimals is far
    // below any real rate's precision and far above the error.
    return Math.ceil(Number((amount * factor).toFixed(9))) / factor
}

/** Numeric display adapter. Missing/invalid data is unavailable, never a fabricated zero. */
export function formatFiniteDisplay(
    value: unknown,
    locales?: Intl.LocalesArgument,
    options?: Intl.NumberFormatOptions
): string {
    const finite = parseFiniteNumber(value)
    if (finite === null) {
        reportInvalidNumeric('format', 'malformed')
        return '—'
    }
    try {
        return finite.toLocaleString(locales, options)
    } catch {
        reportInvalidNumeric('format', 'precision')
        return '—'
    }
}

const validDecimals = (value: number) => Number.isInteger(value) && value >= 0 && value <= 100
