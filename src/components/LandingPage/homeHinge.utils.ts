import type { Locale } from '@/i18n/types'
import type { HomeBalanceTone } from './homeHinge.types'

/** U+2212, the typographic minus the drawn screens use for money out. */
const MINUS = '−'

/** "$3,247.31" in en, "US$ 3.247,31" in es-AR and pt-BR: the reader's own dollar format. */
export function formatUsd(amount: number, locale: Locale): string {
    return new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD' }).format(amount)
}

/** "+$1,670.19" for money in, "−$72.88" for money out. */
export function formatSignedUsd(amount: number, tone: HomeBalanceTone, locale: Locale): string {
    return `${tone === 'in' ? '+' : MINUS}${formatUsd(Math.abs(amount), locale)}`
}

/** "€1,500.00" in en, "€ 1.500,00" in pt-BR. */
export function formatEur(amount: number, locale: Locale): string {
    return new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(amount)
}

/** Always the code ("ARS 120,000", "ARS 120.000"): in Argentina a bare "$" is pesos, elsewhere dollars. */
export function formatArs(amount: number, locale: Locale): string {
    return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: 'ARS',
        currencyDisplay: 'code',
        maximumFractionDigits: 0,
    }).format(amount)
}
