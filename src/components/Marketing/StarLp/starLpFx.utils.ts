import type { StarLpFxRate, StarLpFxReading } from './starLp.types'

/** A rate this young prints exactly, as today's rate. */
export const STAR_LP_FX_LIVE_MAX_AGE_MS = 30 * 60 * 1000
/** Up to this age the last-known rate may print, rounded and marked "≈". Older, no number at all. */
export const STAR_LP_FX_LAST_KNOWN_MAX_AGE_MS = 12 * 60 * 60 * 1000

/**
 * How old the quote is at `nowMs`, measured from the older of the backend's two
 * stamps (`effectiveAt`, when the provider observed it, and `generatedAt`). Both
 * come from the backend, so the visitor's device clock never moves a quote
 * between tiers; `nowMs` is the server's clock at render.
 */
export function starLpFxQuoteAgeMs(quote: StarLpFxRate, nowMs: number): number {
    return nowMs - Math.min(Date.parse(quote.effectiveAt), Date.parse(quote.fetchedAt))
}

/** Sorts a quote (or its absence) into the tier a page may print it in. */
export function starLpFxReading(quote: StarLpFxRate | null, nowMs: number): StarLpFxReading {
    if (!quote) return { tier: 'none', quote: null }
    const age = starLpFxQuoteAgeMs(quote, nowMs)
    if (!Number.isFinite(age)) return { tier: 'none', quote: null }
    if (age <= STAR_LP_FX_LIVE_MAX_AGE_MS) return { tier: 'live', quote }
    if (age <= STAR_LP_FX_LAST_KNOWN_MAX_AGE_MS) return { tier: 'lastKnown', quote }
    return { tier: 'none', quote: null }
}
