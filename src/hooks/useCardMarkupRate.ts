import { useQuery } from '@tanstack/react-query'
import { CARD_FX_MARKUP_BY_CURRENCY } from '@/constants/payment.consts'
import { fetchCardMarkup, type CardMarkup } from '@/utils/fx.utils'

/**
 * Card-vs-local-rail markup for the currencies where the comparison is
 * meaningful. Single source for every card-comparison surface — the qr-pay
 * confirm/success rows, the post-card-spend nudge, and the merchant pages.
 *
 * The model itself lives in the backend (`GET /fx/card-markup`), computed
 * against the same market snapshot the displayed rate comes from. This hook
 * owns only the failure policy: it never rejects. A backend outage falls back
 * to the documented static table, so a surface that renders a savings line
 * keeps rendering one. Currencies with no modeled comparison return null and
 * callers must not render the row.
 *
 * Cached 5 minutes client-side; the response is shared-cacheable for 5 minutes
 * as well.
 *
 * `mantecaPriceUsdToLocal` is optional: pass it when the caller already holds a
 * locked price (the qr-pay confirm screen does) so the saving shown is measured
 * against the price the user will actually get.
 */
export function useCardMarkupRate(currencyCode: string | null | undefined, mantecaPriceUsdToLocal?: number | null) {
    return useQuery<CardMarkup | null>({
        queryKey: ['cardMarkup', currencyCode?.toUpperCase(), mantecaPriceUsdToLocal ?? null],
        queryFn: async () => {
            const code = currencyCode!.toUpperCase()
            try {
                return await fetchCardMarkup(code, mantecaPriceUsdToLocal)
            } catch {
                // Never block a payment surface on a comparison number.
                const fallback = CARD_FX_MARKUP_BY_CURRENCY[code]
                return fallback === undefined ? null : { rate: fallback, source: 'static' }
            }
        },
        enabled: !!currencyCode,
        staleTime: 5 * 60 * 1000,
        gcTime: 10 * 60 * 1000,
        refetchOnWindowFocus: true,
    })
}
