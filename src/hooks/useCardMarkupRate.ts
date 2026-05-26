import { useQuery } from '@tanstack/react-query'
import { getCardMarkupRate, type CardMarkup } from '@/app/actions/card-comparison'

/**
 * Live card-vs-local-rail markup for the currencies where it's meaningful
 * (ARS dynamic via BCRA official; BRL static via IOF + issuer markup). See
 * `getCardMarkupRate` for sourcing rules.
 *
 * Cached 5 minutes client-side; the underlying fetch is also cached 5 minutes
 * on the Next.js server. Returns undefined while loading or when the currency
 * has no meaningful comparison — callers should treat null/undefined as
 * "don't render the savings row".
 */
export function useCardMarkupRate(
    currencyCode: string | null | undefined,
    mantecaPriceUsdToLocal: number | null | undefined
) {
    return useQuery<CardMarkup | null>({
        queryKey: ['cardMarkup', currencyCode?.toUpperCase(), mantecaPriceUsdToLocal],
        queryFn: () => getCardMarkupRate(currencyCode!, mantecaPriceUsdToLocal),
        enabled: !!currencyCode && !!mantecaPriceUsdToLocal && mantecaPriceUsdToLocal > 0,
        staleTime: 5 * 60 * 1000,
        gcTime: 10 * 60 * 1000,
        refetchOnWindowFocus: true,
    })
}
