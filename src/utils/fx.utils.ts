import { apiFetch } from '@/utils/api-fetch'
import type { paths } from '@/types/api.generated'

// This module is imported by the /api/exchange-rate route (a React Server
// module) — it must stay free of client-only imports (react hooks). That is
// why it lives apart from utils/currency.ts, which pulls in useCurrency.

type FxRateResponse = paths['/fx/rate']['get']['responses'][200]['content']['application/json']
type FxCardMarkupResponse = paths['/fx/card-markup']['get']['responses'][200]['content']['application/json']
type FxSelection = FxRateResponse['selection']
type FxSource = FxRateResponse['fromSource']
const PLAIN_DECIMAL = /^(?:0|[1-9]\d*)(?:\.\d{1,18})?$/
// The API market, its shared HTTP cache, and the legacy compatibility route
// each hold a successful response for at most five minutes. Fifteen minutes
// bounds the full chain without accepting an old replay as current.
const MAX_GENERATED_AGE_MS = 15 * 60 * 1000
const MAX_PROVIDER_EFFECTIVE_AGE_MS = 24 * 60 * 60 * 1000
const MAX_REFERENCE_EFFECTIVE_AGE_MS = 30 * 24 * 60 * 60 * 1000
// Bound for comparisons between two backend-stamped times. Both come from the
// same clock, so this stays tight — it is a real sanity check on the payload.
const MAX_FUTURE_CLOCK_SKEW_MS = 5 * 60 * 1000
// Bound for anything compared against the DEVICE clock, which we do not
// control. At five minutes a phone whose clock drifted rejects every response
// the backend can possibly send — permanently, with no fallback path left now
// that the local implementation is gone. Staleness is still genuinely bounded
// by the backend-only observation checks below, which no device clock can
// affect, so this allowance costs correctness nothing.
const MAX_CLIENT_CLOCK_SKEW_MS = 6 * 60 * 60 * 1000
// The backend constrains each USD leg to [1e-9, 1e9]. A cross-rate is a
// quotient of two legs, so its corresponding safe envelope is [1e-18, 1e18].
const MIN_DISPLAY_RATE = 1e-18
const MAX_DISPLAY_RATE = 1e18

export class FxApiError extends Error {
    constructor(
        readonly status: number,
        from: string,
        to: string,
        readonly retryAfter: string | null = null
    ) {
        super(`FX API returned ${status} for ${from}→${to}`)
        this.name = 'FxApiError'
    }
}

function timestamp(value: unknown): number | null {
    if (typeof value !== 'string') return null
    const parsed = Date.parse(value)
    return Number.isFinite(parsed) && new Date(parsed).toISOString() === value ? parsed : null
}

function isFxSelection(value: unknown): value is FxSelection {
    return value === 'identity' || value === 'provider_pair' || value === 'reference_pair'
}

function isFxSource(value: unknown): value is FxSource {
    return value === 'identity' || value === 'bridge' || value === 'manteca' || value === 'reference'
}

function isProviderSource(value: FxSource): value is 'bridge' | 'manteca' {
    return value === 'bridge' || value === 'manteca'
}

function isSelectionSource(currency: string, source: FxSource, selection: Exclude<FxSelection, 'identity'>): boolean {
    if (currency === 'USD') return source === 'identity'
    if (selection === 'provider_pair') return isProviderSource(source)
    return source === 'reference'
}

function parseFxRateResponse(value: unknown, from: string, to: string): number | null {
    if (!value || typeof value !== 'object') return null

    const data = value as Partial<FxRateResponse>
    if (data.from !== from || data.to !== to) return null
    if (data.basis !== 'display_sell' || data.indicative !== true) return null
    if (!isFxSelection(data.selection) || !isFxSource(data.fromSource) || !isFxSource(data.toSource)) return null
    if (typeof data.rate !== 'string' || !PLAIN_DECIMAL.test(data.rate)) return null

    const generatedAt = timestamp(data.generatedAt)
    if (generatedAt === null) return null
    const generatedAge = Date.now() - generatedAt
    if (generatedAge > MAX_GENERATED_AGE_MS + MAX_CLIENT_CLOCK_SKEW_MS || generatedAge < -MAX_CLIENT_CLOCK_SKEW_MS) {
        return null
    }

    // Identity is handled locally before the request. Every backend response
    // consumed here must therefore be one complete non-identity domain.
    if (data.selection === 'identity' || data.effectiveAt === null) return null
    if (
        !isSelectionSource(from, data.fromSource, data.selection) ||
        !isSelectionSource(to, data.toSource, data.selection)
    ) {
        return null
    }

    const effectiveAt = timestamp(data.effectiveAt)
    if (effectiveAt === null) return null
    const maxObservationAge =
        data.selection === 'provider_pair' ? MAX_PROVIDER_EFFECTIVE_AGE_MS : MAX_REFERENCE_EFFECTIVE_AGE_MS
    const observationAgeAtGeneration = generatedAt - effectiveAt
    const effectiveAgeNow = Date.now() - effectiveAt
    if (
        observationAgeAtGeneration > maxObservationAge ||
        observationAgeAtGeneration < -MAX_FUTURE_CLOCK_SKEW_MS ||
        effectiveAgeNow > maxObservationAge + MAX_GENERATED_AGE_MS + MAX_CLIENT_CLOCK_SKEW_MS ||
        effectiveAgeNow < -MAX_CLIENT_CLOCK_SKEW_MS
    ) {
        return null
    }

    const rate = Number(data.rate)
    return Number.isFinite(rate) && rate >= MIN_DISPLAY_RATE && rate <= MAX_DISPLAY_RATE ? rate : null
}

/**
 * Reads the backend's shared indicative display rate. This is the common
 * implementation for first-party browser/native clients and the web
 * compatibility route. Commit paths still use getCurrencyPrice to fetch an
 * execution-side quote.
 */
export async function fetchDisplayRate(fromCurrency: string, toCurrency: string): Promise<number> {
    const from = fromCurrency.toUpperCase()
    const to = toCurrency.toUpperCase()
    // Exact mathematical identity does not depend on network availability and
    // was the established UI behavior before the shared API existed.
    if (from === to) return 1

    const query = new URLSearchParams({ from, to })
    const response = await apiFetch(`/fx/rate?${query.toString()}`, {
        method: 'GET',
        includeAuth: false,
        credentials: 'omit',
        redirect: 'error',
        timeoutMs: 10_000,
    })
    if (!response.ok) {
        throw new FxApiError(response.status, from, to, response.headers?.get?.('Retry-After') ?? null)
    }

    let data: unknown
    try {
        data = await response.json()
    } catch {
        throw new Error(`FX API returned invalid JSON for ${from}→${to}`)
    }

    const rate = parseFxRateResponse(data, from, to)
    if (rate === null) {
        throw new Error(`FX API returned an invalid rate contract for ${from}→${to}`)
    }
    return rate
}

export interface CardMarkup {
    /** Markup as a fraction: card price = peanut price × (1 + rate). */
    rate: number
    /** Whether the backend computed this from live observations or served its documented assumption. */
    source: 'live' | 'static'
}

// A card costing half again as much as Peanut is an upstream fault, not a
// saving worth advertising. The backend already bounds its live lane tighter;
// this is the client's own refusal to render an absurd claim.
const MAX_CARD_MARKUP = 0.5

function positiveDecimal(value: unknown): number | null {
    if (typeof value !== 'string' || !PLAIN_DECIMAL.test(value)) return null
    const parsed = Number(value)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function parseCardMarkupResponse(
    value: unknown,
    currency: string,
    lockedPeanutRate?: number | null
): CardMarkup | null {
    if (!value || typeof value !== 'object') return null

    const data = value as Partial<FxCardMarkupResponse>
    if (data.currency !== currency || data.indicative !== true) return null
    if (data.source !== 'live' && data.source !== 'static') return null

    const generatedAt = timestamp(data.generatedAt)
    if (generatedAt === null) return null
    const generatedAge = Date.now() - generatedAt
    if (generatedAge > MAX_GENERATED_AGE_MS + MAX_CLIENT_CLOCK_SKEW_MS || generatedAge < -MAX_CLIENT_CLOCK_SKEW_MS) {
        return null
    }

    const markupPct = positiveDecimal(data.markupPct)
    if (markupPct === null || markupPct >= MAX_CARD_MARKUP) return null
    if (data.source === 'static') return { rate: markupPct, source: 'static' }

    // A live answer without its inputs cannot be a live answer.
    const components = data.components
    if (!components || typeof components !== 'object') return null
    const officialUsdRate = positiveDecimal(components.officialUsdRate)
    const issuerFeePct = positiveDecimal(components.issuerFeePct)
    if (positiveDecimal(components.peanutUsdRate) === null || officialUsdRate === null || issuerFeePct === null) {
        return null
    }
    if (issuerFeePct >= 1) return null

    // A caller holding a locked Peanut price must compare a card against THAT
    // price. Otherwise the saving on screen is not the saving the user gets.
    if (typeof lockedPeanutRate === 'number' && lockedPeanutRate > 0) {
        // The issuer fee is charged on top of the converted amount, so the
        // rate a cardholder receives is the official rate divided by 1 + fee.
        const lockedMarkup = lockedPeanutRate / (officialUsdRate / (1 + issuerFeePct)) - 1
        if (Number.isFinite(lockedMarkup) && lockedMarkup > 0 && lockedMarkup < MAX_CARD_MARKUP) {
            return { rate: lockedMarkup, source: 'live' }
        }
    }
    return { rate: markupPct, source: 'live' }
}

/**
 * Reads the backend's indicative card-vs-Peanut markup. Throws on every
 * failure — the fallback policy lives in `useCardMarkupRate`, so a caller that
 * wants the raw contract still gets it.
 *
 * @param lockedPeanutRate Optional. Local-currency units per USD the caller has
 *        already locked (a QR payment does). Ignored on a static answer, which
 *        carries no components to recompute from.
 */
export async function fetchCardMarkup(currencyCode: string, lockedPeanutRate?: number | null): Promise<CardMarkup> {
    const currency = currencyCode.toUpperCase()
    const query = new URLSearchParams({ currency })
    const response = await apiFetch(`/fx/card-markup?${query.toString()}`, {
        method: 'GET',
        includeAuth: false,
        credentials: 'omit',
        redirect: 'error',
        timeoutMs: 10_000,
    })
    if (!response.ok) {
        throw new FxApiError(response.status, currency, 'card-markup', response.headers?.get?.('Retry-After') ?? null)
    }

    let data: unknown
    try {
        data = await response.json()
    } catch {
        throw new Error(`FX API returned invalid JSON for the ${currency} card markup`)
    }

    const markup = parseCardMarkupResponse(data, currency, lockedPeanutRate)
    if (markup === null) throw new Error(`FX API returned an invalid card-markup contract for ${currency}`)
    return markup
}
