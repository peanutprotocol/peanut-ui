import { serverFetch } from '@/utils/api-fetch'
import { parseFxRateQuote } from '@/utils/fx.utils'
import type { StarLpFxRate } from './starLp.types'

/**
 * Live indicative rates for the star LPs, read on the server from the same
 * public /fx/rate the app's QR, send and widget screens use, through the
 * sanctioned serverFetch wrapper (no auth header: the rate is public).
 *
 * The backend and its CDN cache a rate for 5 minutes, so the page revalidates
 * on the same clock: about one request per pair per 5 minutes, whatever the traffic.
 *
 * Fallback: `null` when the API is down, slow, off-contract or stale. The page
 * then hides the converted line and the "1 USD = …" row and shows only the
 * local-currency price. A page never shows a rate it did not just read.
 */

export const STAR_LP_FX_REVALIDATE_S = 300
const FETCH_TIMEOUT_MS = 8_000
// Next's Data Cache keeps serving the last good body when a revalidation
// fails, so a rate can outlive the API. Our own clock decides: older than
// this and the line comes off the page.
const MAX_RATE_AGE_MS = 30 * 60 * 1000

export async function fetchStarLpFxRate(fromCurrency: string, toCurrency: string): Promise<StarLpFxRate | null> {
    const from = fromCurrency.toUpperCase()
    const to = toCurrency.toUpperCase()
    try {
        const query = new URLSearchParams({ from, to })
        const response = await serverFetch(`/fx/rate?${query.toString()}`, {
            includeAuth: false,
            credentials: 'omit',
            redirect: 'error',
            // per-leg budget; the signal caps the whole call (the wrapper retries
            // a GET once on timeout) so a render never waits longer than this
            timeoutMs: FETCH_TIMEOUT_MS,
            signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
            // a slow API is a designed fallback here (the line comes off the page)
            silentTimeout: true,
            next: { revalidate: STAR_LP_FX_REVALIDATE_S },
        })
        if (!response.ok) return null
        const quote = parseFxRateQuote(await response.json(), from, to)
        if (!quote) return null
        if (Date.now() - Date.parse(quote.generatedAt) > MAX_RATE_AGE_MS) return null
        const source = quote.fromSource === 'identity' ? quote.toSource : quote.fromSource
        if (source === 'identity') return null
        return { from, to, rate: quote.rate, source, fetchedAt: quote.generatedAt }
    } catch {
        return null
    }
}

/** ARS per USD at Manteca's sell price: the rate an Argentine QR payment executes at. */
export function fetchUsdArsRate() {
    return fetchStarLpFxRate('USD', 'ARS')
}

/** BRL per USD at Manteca's sell price: the rate a Pix payment executes at. */
export function fetchUsdBrlRate() {
    return fetchStarLpFxRate('USD', 'BRL')
}

/** USD per EUR at Bridge's buy rate: what an incoming SEPA deposit converts at. */
export function fetchEurUsdRate() {
    return fetchStarLpFxRate('EUR', 'USD')
}
