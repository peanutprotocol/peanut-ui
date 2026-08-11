import { useQuery } from '@tanstack/react-query'
import { CARD_FX_MARKUP_BY_CURRENCY } from '@/constants/payment.consts'
import { fetchCardMarkup, FxApiError, type CardMarkup } from '@/utils/fx.utils'

/**
 * Card-vs-local-rail markup for the currencies where the comparison is
 * meaningful. Single source for every card-comparison surface — the qr-pay
 * confirm/success rows, the post-card-spend nudge, and the merchant pages.
 *
 * The model itself lives in the backend (`GET /fx/card-markup`), computed
 * against the same market snapshot the displayed rate comes from. This hook
 * owns only the failure policy: it never rejects.
 *
 * The two failure kinds are NOT the same, and conflating them publishes a
 * false claim. A `404` is the backend saying it has no comparison to publish —
 * an unmodeled currency, or observations proving there is no saving right now.
 * Falling back to the static table there would advertise a 9% saving against
 * evidence of none, so a `404` returns null and the caller renders no row.
 * Any other failure means the model was unreachable, which is exactly what the
 * documented static assumption is for.
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
            } catch (error) {
                // The backend has no comparison to publish — render nothing.
                if (error instanceof FxApiError && error.status === 404) return null
                // Unreachable, not disproven. Never block a payment surface on
                // a comparison number.
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
