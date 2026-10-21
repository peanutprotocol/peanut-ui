import type { StarLpFxReading } from '@/components/Marketing/StarLp/starLp.types'
import type { QrArgentinaRateHeadlineData } from './qrArgentina.types'

const RATE = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const ROUNDED = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })

// Widths in em of the headline's line (Roboto Flex extra-black, tabular digits,
// the h2's tracking), measured on the page: a digit, a "," or ".", and the small
// "ARS" with its gap. The font size sets the whole line at 94% of the column,
// so the exact and the rounded number fit alike.
const DIGIT_EM = 0.55
const SEPARATOR_EM = 0.31
const ARS_EM = 0.6
const LINE_FIT_CQW = 94

function fitFontSize(value: string): string {
    const digits = value.replace(/\D/g, '').length
    const em = digits * DIGIT_EM + (value.length - digits) * SEPARATOR_EM + ARS_EM
    return `${(LINE_FIT_CQW / em).toFixed(2)}cqw`
}

/** ARS per USD as the fold and the pay screen print it: always two decimals, so the width never jumps. */
export function formatUsdArsRate(rate: number): string {
    return RATE.format(rate)
}

/** A last-known rate rounded to the nearest 10 ARS: 1,601.88 → 1,600. */
export function roundUsdArsRate(rate: number): number {
    return Math.round(rate / 10) * 10
}

/**
 * The headline for each tier, or `null` for none (the fold then says "Best rate").
 * Live: "$1 =" over the exact rate, which counts up. Last-known (30 min–12 h):
 * "$1 ≈" over the rate rounded to the nearest 10, at rest. The font size fits
 * the number to the column whatever its digit count.
 */
export function qrArgentinaRateHeadline(usdArs: StarLpFxReading): QrArgentinaRateHeadlineData | null {
    if (usdArs.tier === 'none') return null
    const live = usdArs.tier === 'live'
    const rate = live ? usdArs.quote.rate : roundUsdArsRate(usdArs.quote.rate)
    const value = live ? formatUsdArsRate(rate) : ROUNDED.format(rate)
    return {
        lead: live ? '$1 =' : '$1 ≈',
        rate,
        value,
        label: live ? `$1 = ${value} ARS` : `$1 is about ${value} ARS`,
        fontSize: fitFontSize(value),
        countsUp: live,
    }
}

/**
 * Where the count-up starts: the power of ten below the rate (1,000.00 for
 * 1,596.75). Same digit count, so the number keeps its width while it climbs.
 */
export function qrArgentinaRateCountFrom(rate: number): number {
    return 10 ** Math.floor(Math.log10(rate))
}

/** The rate shown at `progress` (0–1) of the count-up, eased out so it settles on the live value. */
export function qrArgentinaRateAt(from: number, to: number, progress: number): number {
    const t = Math.min(1, Math.max(0, progress))
    return from + (to - from) * (1 - (1 - t) ** 3)
}
