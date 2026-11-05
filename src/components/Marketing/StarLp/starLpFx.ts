import { unstable_cache } from 'next/cache'
import { serverFetch } from '@/utils/api-fetch'
import { parseFxRateQuote } from '@/utils/fx.utils'
import { STAR_LP_FX_BACKOFF_MS, starLpFxBackoff } from './starLpFxBackoff'
import { starLpFxReading } from './starLpFx.utils'
import type { StarLpFxRate, StarLpFxReading } from './starLp.types'

/**
 * Indicative rates for the star LPs, read on the server from the same public
 * /fx/rate the app's QR, send and widget screens use, through the sanctioned
 * serverFetch wrapper (no auth header: the rate is public).
 *
 * Last-known snapshot: each pair's last valid quote is kept in Next's Data
 * Cache (unstable_cache; on Vercel, the regional Data Cache that persists
 * across deployments). It revalidates every 5 minutes, the backend's own cache
 * clock. Stale, it is served at once while a background read refreshes it. A
 * failed read throws, and a throw never overwrites the entry, so the last
 * good quote survives an outage until LRU eviction or a purge.
 *
 * The snapshot only holds the number. Which tier a page prints it in is
 * decided per request from the backend's own timestamps (starLpFxReading):
 * live up to 30 minutes, last-known up to 12 hours, then none.
 */

export const STAR_LP_FX_REVALIDATE_S = 300
const FETCH_TIMEOUT_MS = 8_000
// The snapshot can be old after a quiet spell while the API is fine. One more
// read is tried in the render, kept short so an outage costs a visitor at most this.
const REFRESH_TIMEOUT_MS = 2_000

/** One validated read of /fx/rate. Throws on any failure, so a cached snapshot is never replaced by nothing. */
async function readStarLpFxQuote(from: string, to: string, timeoutMs: number): Promise<StarLpFxRate> {
    const query = new URLSearchParams({ from, to })
    const response = await serverFetch(`/fx/rate?${query.toString()}`, {
        includeAuth: false,
        credentials: 'omit',
        redirect: 'error',
        // per-leg budget; the signal caps the whole call (the wrapper retries
        // a GET once on timeout) so a read never waits longer than this
        timeoutMs,
        signal: AbortSignal.timeout(timeoutMs),
        // a slow API is a designed fallback here (the tiers step down)
        silentTimeout: true,
        // the snapshot below is the only cache layer
        cache: 'no-store',
    })
    if (!response.ok) throw new Error(`/fx/rate ${from}→${to} returned ${response.status}`)
    const body: unknown = await response.json()
    const quote = parseFxRateQuote(body, from, to)
    if (!quote) throw new Error(`/fx/rate ${from}→${to} is off-contract or stale`)
    const source = quote.fromSource === 'identity' ? quote.toSource : quote.fromSource
    if (source === 'identity') throw new Error(`/fx/rate ${from}→${to} has no provider leg`)
    // parseFxRateQuote has checked effectiveAt: an ISO instant, never null on a non-identity pair
    const { effectiveAt } = body as { effectiveAt: string }
    return { from, to, rate: quote.rate, source, fetchedAt: quote.generatedAt, effectiveAt }
}

const readSnapshot = unstable_cache(
    (from: string, to: string) => readStarLpFxQuote(from, to, FETCH_TIMEOUT_MS),
    ['star-lp-fx-snapshot'],
    { revalidate: STAR_LP_FX_REVALIDATE_S }
)

/** The pair's quote with the tier it may print in. Never throws. */
export async function fetchStarLpFxReading(fromCurrency: string, toCurrency: string): Promise<StarLpFxReading> {
    const from = fromCurrency.toUpperCase()
    const to = toCurrency.toUpperCase()
    // Next never stores a failed read, so on a hanging API every render would wait out
    // the budget again. After a failed read, renders skip that read for a minute: the
    // cold read when there is no snapshot, the direct read when the snapshot is old.
    const cold = `${from}|${to}|cold`
    const refresh = `${from}|${to}|refresh`
    const waiting = (key: string) => Date.now() < (starLpFxBackoff.get(key) ?? 0)
    const fail = (key: string) => starLpFxBackoff.set(key, Date.now() + STAR_LP_FX_BACKOFF_MS)
    if (waiting(cold)) return starLpFxReading(null, Date.now())
    let snapshot: StarLpFxRate
    try {
        snapshot = await readSnapshot(from, to)
    } catch {
        // no snapshot at all, and the read that just ran failed
        fail(cold)
        return starLpFxReading(null, Date.now())
    }
    const reading = starLpFxReading(snapshot, Date.now())
    if (reading.tier === 'live' || waiting(refresh)) return reading
    try {
        return starLpFxReading(await readStarLpFxQuote(from, to, REFRESH_TIMEOUT_MS), Date.now())
    } catch {
        fail(refresh)
        return reading
    }
}

/**
 * The live rate only (30 minutes), or `null`. For pages that print the rate
 * as a small proof line, where a rounded or old value has no place.
 */
export async function fetchStarLpFxRate(fromCurrency: string, toCurrency: string): Promise<StarLpFxRate | null> {
    const reading = await fetchStarLpFxReading(fromCurrency, toCurrency)
    return reading.tier === 'live' ? reading.quote : null
}

/** ARS per USD at Manteca's sell price, with its tier: the Argentina rate fold prints all three. */
export function fetchUsdArsRate() {
    return fetchStarLpFxReading('USD', 'ARS')
}

/** USD per EUR (Bridge leg): what an incoming SEPA deposit converts at, indicatively. Live only. */
export function fetchEurUsdRate() {
    return fetchStarLpFxRate('EUR', 'USD')
}

/** BRL per USD at Manteca's sell price: the rate a Pix payment executes at. Live only. */
export function fetchUsdBrlRate() {
    return fetchStarLpFxRate('USD', 'BRL')
}
