import { useQuery } from '@tanstack/react-query'
import { getCardMarkupRate, type CardMarkup } from '@/app/actions/card-comparison'

/**
 * Live card-vs-local-rail markup for the currencies where it's meaningful
 * (ARS dynamic via BCRA official; BRL static via IOF + issuer markup). See
 * `getCardMarkupRate` for sourcing rules. Single source for every card-
 * comparison surface — confirm/success rows and the post-spend nudge.
 *
 * Cached 5 minutes client-side; the underlying fetch is also cached 5 minutes
 * on the Next.js server. Returns undefined while loading or when the currency
 * has no meaningful comparison — callers should treat null/undefined as
 * "don't render the savings row".
 *
 * `mantecaPriceUsdToLocal` is optional: if the caller already has the price
 * (qr-pay confirm screen does), pass it to avoid a second fetch on the
 * server side. Other callers (e.g. the post-card-spend nudge) just pass the
 * currency code and the action fetches Manteca itself.
 */
export function useCardMarkupRate(currencyCode: string | null | undefined, mantecaPriceUsdToLocal?: number | null) {
    return useQuery<CardMarkup | null>({
        queryKey: ['cardMarkup', currencyCode?.toUpperCase(), mantecaPriceUsdToLocal ?? null],
        queryFn: () => getCardMarkupRate(currencyCode!, mantecaPriceUsdToLocal),
        enabled: !!currencyCode,
        staleTime: 5 * 60 * 1000,
        gcTime: 10 * 60 * 1000,
        refetchOnWindowFocus: true,
    })
}
