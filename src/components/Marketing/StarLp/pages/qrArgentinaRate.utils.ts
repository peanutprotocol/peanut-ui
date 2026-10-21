import type { StarLpFxRate } from '@/components/Marketing/StarLp/starLp.types'
import type { QrArgentinaRateHeadlineData } from './qrArgentina.types'

const RATE = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// The number takes 0.48em per character (Roboto Flex extra-black, tabular digits),
// so this many cqw over the character count sets it at 80% of the column width.
const RATE_FIT_CQW = 166

/** ARS per USD as the fold and the pay screen print it: always two decimals, so the width never jumps. */
export function formatUsdArsRate(rate: number): string {
    return RATE.format(rate)
}

/**
 * The headline for a live rate, or `null` when there is none: the fold then shows
 * its fallback title. The font size fits the number to the column whatever its
 * digit count.
 */
export function qrArgentinaRateHeadline(usdArs: StarLpFxRate | null): QrArgentinaRateHeadlineData | null {
    if (!usdArs) return null
    const value = formatUsdArsRate(usdArs.rate)
    return { rate: usdArs.rate, value, fontSize: `${(RATE_FIT_CQW / value.length).toFixed(2)}cqw` }
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
