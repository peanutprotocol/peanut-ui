import { getCachedCurrencyPrice } from '@/app/actions/currency'

// This module is imported by the /api/exchange-rate route (a React Server
// module) — it must stay free of client-only imports (react hooks). That is
// why it lives apart from utils/currency.ts, which pulls in useCurrency.

/**
 * Display-policy conversion between two provider-normalized prices (each
 * expressed as currency units per USD). Both orientations of a pair are quoted
 * off the withdrawal-execution (sell) side so one pair implies one price; USD
 * normalizes to `{ buy: 1, sell: 1 }`, so this single expression covers
 * direct (USD→X), reverse (X→USD), and cross (X→Y) pairs.
 */
export const displayRateFromPrices = (from: { sell: number }, to: { sell: number }): number => (1 / from.sell) * to.sell

/**
 * Display exchange rate for any currency pair — the single implementation
 * behind both the /api/exchange-rate route (web) and the Capacitor branch of
 * useExchangeRate (native, where no Next.js server exists). Provider prices
 * come from getCachedCurrencyPrice; pairs no provider covers fall back to
 * Frankfurter mid-market with a ×0.995 spread approximation so the fallback
 * doesn't overstate what a transfer delivers. Display surfaces only — commit
 * paths quote their own executed side via the uncached getCurrencyPrice.
 */
export async function fetchDisplayRate(fromCurrency: string, toCurrency: string): Promise<number> {
    const from = fromCurrency.toUpperCase()
    const to = toCurrency.toUpperCase()
    // exact 1 for same-currency pairs, without provider calls (and without
    // float noise from (1/sell)*sell)
    if (from === to) return 1

    try {
        const [fromPrice, toPrice] = await Promise.all([getCachedCurrencyPrice(from), getCachedCurrencyPrice(to)])
        const rate = displayRateFromPrices(fromPrice, toPrice)
        if (isFinite(rate) && rate > 0) return rate
    } catch (error) {
        // lands here for provider outages AND for currencies no provider serves
        // ('Invalid currency code') — both continue to the Frankfurter fallback
        console.warn(`No provider price for ${from}→${to}, falling back to Frankfurter:`, error)
    }

    // Fallback: synthesize a sell-side price per currency from Frankfurter
    // mid-market — the ×0.995 spread is applied once, on each currency's
    // USD-leg price, then converted through the same displayRateFromPrices
    // policy as the provider path. Applying the spread per-request instead
    // (the old behavior) made the two orientations of a pair multiply to
    // 0.995² rather than 1, breaking the one-pair-one-price contract on
    // every fallback-served pair.
    // `next.revalidate` is a 5-min data cache on the server, a no-op in the
    // browser (Capacitor static build).
    const options: RequestInit & { next?: { revalidate?: number } } = { next: { revalidate: 300 } }
    const targets = [from, to].filter((code) => code !== 'USD').join(',')
    const res = await fetch(`https://api.frankfurter.app/latest?from=USD&to=${targets}`, options)
    if (res.ok) {
        const data = await res.json()
        const syntheticSellPrice = (code: string) => ({ sell: code === 'USD' ? 1 : data?.rates?.[code] * 0.995 })
        const rate = displayRateFromPrices(syntheticSellPrice(from), syntheticSellPrice(to))
        if (isFinite(rate) && rate > 0) return rate
    }
    throw new Error(`Failed to fetch exchange rate for ${from}→${to}`)
}
