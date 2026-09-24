import { fetchOfframpRate, FxApiError } from '@/utils/fx.utils'

/**
 * The one query for the public withdrawal rate (GET /bridge/offramp/rate).
 * The widget's pill and every withdrawal minimum read it through this key, so
 * a screen never shows one rate and enforces a minimum from another.
 * Same caching and retry rules as the /fx/rate display query.
 */
export function offrampRateQueryOptions(destinationCurrency: string) {
    const currency = destinationCurrency.toUpperCase()
    return {
        queryKey: ['offrampRate', currency],
        queryFn: async () => ({ rate: await fetchOfframpRate(currency) }),
        staleTime: 5 * 60 * 1000,
        gcTime: 10 * 60 * 1000,
        refetchOnWindowFocus: true,
        refetchInterval: 5 * 60 * 1000,
        // a rate limit or a refused pair is final: retrying only adds requests
        retry: (failureCount: number, error: Error) =>
            !(error instanceof FxApiError && [400, 404, 429].includes(error.status)) && failureCount < 3,
    }
}
