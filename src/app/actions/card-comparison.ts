import { CARD_FX_MARKUP_BY_CURRENCY } from '@/constants/payment.consts'
import { getCurrencyPrice } from '@/app/actions/currency'

/**
 * Typical foreign-issuer FX markup applied on top of the network rate. Visa/MC
 * deliver near mid-market; the issuing bank adds 2–3% as a foreign-transaction
 * fee. Used by the ARS dynamic calc on top of the BCRA official rate.
 */
const ISSUER_FX_FEE = 0.03

export interface CardMarkup {
    /** Savings as a fraction of the Peanut USD amount (i.e. usdAmount × rate = USD saved). */
    rate: number
    /** Whether the rate came from a live source or fell back to a static constant. */
    source: 'live' | 'static'
}

/**
 * Single source of truth for "how much extra does a foreign card cost vs
 * Peanut's local rail" — shared by every card-comparison surface (the QR pay
 * confirm + success screens, and the post-card-spend nudge on transaction
 * receipts). Currencies where the comparison is meaningful: ARS, BRL today.
 *
 * - ARS: live. BCRA official rate via dolarapi.com (what a foreign card user
 *        actually gets in Argentina post-PAIS-elimination) compared to
 *        Manteca's MEP/blue-equivalent rate that Peanut delivers. Spread
 *        fluctuates daily — anywhere from ~5% to ~25% historically — which is
 *        why this can't be a constant. Note: Manteca's price has its own
 *        spread baked in, so the returned rate reflects what Peanut actually
 *        delivers vs what a card delivers, not a pure BCRA-vs-MEP gap.
 * - BRL: static. IOF on foreign card purchases (3.5% as of 2025, phasing to 0
 *        by 2028) + issuer FX markup ~3%. Statutory + contract — not moving
 *        on FX news.
 *
 * Returns null if the currency has no meaningful card-vs-local-rail gap.
 *
 * @param currencyCode ISO code, case-insensitive
 * @param mantecaPriceUsdToLocal Optional. If the caller already has Manteca's
 *        rate (e.g. from a QR payment lock), pass it to avoid an extra fetch.
 *        Otherwise the action fetches it itself. Unused for static-fallback
 *        currencies (BRL).
 */
export async function getCardMarkupRate(
    currencyCode: string,
    mantecaPriceUsdToLocal?: number | null
): Promise<CardMarkup | null> {
    const code = currencyCode?.toUpperCase()
    if (!code) return null
    const staticRate = CARD_FX_MARKUP_BY_CURRENCY[code]
    if (staticRate === undefined) return null

    if (code === 'ARS') {
        try {
            let mantecaPrice = mantecaPriceUsdToLocal
            if (!mantecaPrice || mantecaPrice <= 0) {
                const { sell } = await getCurrencyPrice('ARS')
                mantecaPrice = sell
            }
            if (mantecaPrice && mantecaPrice > 0) {
                const res = await fetch('https://dolarapi.com/v1/dolares/oficial', {
                    next: { revalidate: 300 },
                })
                if (res.ok) {
                    const data = (await res.json()) as { venta?: number }
                    const bcraOfficial = Number(data?.venta)
                    if (Number.isFinite(bcraOfficial) && bcraOfficial > 0) {
                        const effectiveCardRate = bcraOfficial * (1 - ISSUER_FX_FEE)
                        const rate = mantecaPrice / effectiveCardRate - 1
                        if (Number.isFinite(rate) && rate > 0) {
                            return { rate, source: 'live' }
                        }
                    }
                }
            }
        } catch {
            // Swallow — fall through to static fallback below. Never block
            // the payment flow on a third-party FX feed being down.
        }
    }

    return { rate: staticRate, source: 'static' }
}
