import type { Locale } from '@/i18n/types'
import type { HomeBalanceTone } from './homeHinge.types'

/** U+2212, the typographic minus the drawn screens use for money out. */
const MINUS = '−'

/**
 * The Intl locale for a page locale's numbers. Intl's es-419 data groups like en
 * ("1,500.00"), but LATAM Spanish writes "1.500,00" (localization.es-419.md § 5),
 * as es-AR does.
 */
function numberLocale(locale: Locale): string {
    return locale === 'es-419' ? 'es-AR' : locale
}

/**
 * Symbols in en ("$", "€"); codes in es and pt-BR ("USD", "EUR"), as the locale
 * guides write dollars (localization.es-ar.md § 5, localization.pt-br.md § 5) and
 * as ARS is always written, so one activity list never mixes a symbol and codes.
 */
function currencyDisplay(locale: Locale): 'symbol' | 'code' {
    return locale === 'en' ? 'symbol' : 'code'
}

/**
 * "$3,247.31" in en, "USD 3.247,31" in es and pt-BR: the reader's own dollar format.
 * `whole` drops the cents ("$250", "USD 250").
 */
export function formatUsd(amount: number, locale: Locale, { whole = false }: { whole?: boolean } = {}): string {
    return new Intl.NumberFormat(numberLocale(locale), {
        style: 'currency',
        currency: 'USD',
        currencyDisplay: currencyDisplay(locale),
        ...(whole && { minimumFractionDigits: 0, maximumFractionDigits: 0 }),
    }).format(amount)
}

/** "+$1,670.19" for money in, "−$72.88" for money out. */
export function formatSignedUsd(amount: number, tone: HomeBalanceTone, locale: Locale): string {
    return `${tone === 'in' ? '+' : MINUS}${formatUsd(Math.abs(amount), locale)}`
}

/** "€1,500.00" in en, "EUR 1.500,00" in es and pt-BR. */
export function formatEur(amount: number, locale: Locale): string {
    return new Intl.NumberFormat(numberLocale(locale), {
        style: 'currency',
        currency: 'EUR',
        currencyDisplay: currencyDisplay(locale),
    }).format(amount)
}

/** Always the code ("ARS 120,000", "ARS 120.000"): in Argentina a bare "$" is pesos, elsewhere dollars. */
export function formatArs(amount: number, locale: Locale): string {
    return new Intl.NumberFormat(numberLocale(locale), {
        style: 'currency',
        currency: 'ARS',
        currencyDisplay: 'code',
        maximumFractionDigits: 0,
    }).format(amount)
}
