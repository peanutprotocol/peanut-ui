'use server'

/**
 * Local copy of the ARS card-vs-Peanut markup service.
 *
 * Mirrors `getCardMarkupRate` in `src/app/actions/card-comparison.ts` from
 * PR #2108 (qr-pay live card savings) — same formula, same constants, same
 * graceful-fallback contract. Lives here temporarily so the Stain landing
 * page can ship with live data ahead of #2108 merging. When that PR lands:
 * swap the import in `MerchantLandingPage.tsx` for the shared action and
 * delete this file.
 *
 * Why server-side: keeps the third-party dolarapi.com call off the client
 * (no CORS, no per-visitor hit), and Next's `revalidate: 300` caches the
 * response at the edge for 5 minutes — so a viral pilot day doesn't pelt
 * dolarapi from every browser.
 *
 * Why the comparison exists at all: Peanut delivers the cripto/MEP rate
 * (via Manteca), while a foreign card in Argentina gets the BCRA-official
 * rate minus an issuer FX fee. The spread fluctuates daily (historically
 * 5–25%), which is why we compute live rather than hardcoding a single
 * marketing number. The 9.13% fallback is the documented BCRA-vs-MEP +
 * issuer empirical average — used only when the live fetch is unavailable.
 */

/** Documented empirical ARS card-vs-local-rail spread + issuer markup. */
const ARS_STATIC_MARKUP = 0.0913
/** Foreign-issuer FX fee on top of the network rate — Visa/MC ~mid-market, bank adds 2–3%. */
const ISSUER_FX_FEE = 0.03
/** Abort the live FX fetch if dolarapi hangs, so SSR falls back to the static markup fast. */
const FX_FETCH_TIMEOUT_MS = 2500

export interface CardMarkup {
    /** Markup as a fraction: card_price = peanut_price × (1 + rate). */
    rate: number
    /** Whether the live BCRA feed succeeded ('live') or we fell back to the static constant ('static'). */
    source: 'live' | 'static'
}

/**
 * Live ARS card-vs-Peanut markup. Never throws — always returns a defensible
 * value so the caller (the menu fold + the live-rate banner) can render
 * unconditionally.
 *
 * @param criptoUsdToArs ARS per 1 USD that Peanut delivers (Manteca effectiveSell).
 *                       Required for the live spread calc; with no cripto baseline
 *                       we can't compute a meaningful markup, so we return static.
 */
export async function getArsCardMarkup(criptoUsdToArs: number): Promise<CardMarkup> {
    if (!Number.isFinite(criptoUsdToArs) || criptoUsdToArs <= 0) {
        return { rate: ARS_STATIC_MARKUP, source: 'static' }
    }

    try {
        const res = await fetch('https://dolarapi.com/v1/dolares/oficial', {
            next: { revalidate: 300 }, // 5min edge cache so we don't hit dolarapi per visitor
            signal: AbortSignal.timeout(FX_FETCH_TIMEOUT_MS),
        })
        if (res.ok) {
            const data = (await res.json()) as { venta?: number }
            const bcraOfficial = Number(data?.venta)
            if (Number.isFinite(bcraOfficial) && bcraOfficial > 0) {
                const effectiveCardRate = bcraOfficial * (1 - ISSUER_FX_FEE)
                const rate = criptoUsdToArs / effectiveCardRate - 1
                if (Number.isFinite(rate) && rate > 0) {
                    return { rate, source: 'live' }
                }
            }
        }
    } catch {
        // Swallow — never block the page on a third-party FX feed being down.
    }

    return { rate: ARS_STATIC_MARKUP, source: 'static' }
}
