'use client'

import { useQuery } from '@tanstack/react-query'
import {
    fetchDisplayRates,
    fetchFeeSchedule,
    fetchReferenceBenchmarks,
    type FxBulkRatesSnapshot,
    type FxFeeSchedule,
    type FxReferenceBenchmarks,
} from '@/utils/fx.utils'
import { BENCHMARK_CURRENCIES, FALLBACK_FEE_SCHEDULE } from './rates-fees.utils'
import type { SupportedExchangeCurrency } from '@/constants/exchange-currencies.consts'

const FIVE_MINUTES_MS = 5 * 60 * 1000

export function useAllDisplayRates() {
    return useQuery<FxBulkRatesSnapshot>({
        queryKey: ['fx', 'rates', 'USD'],
        queryFn: () => fetchDisplayRates('USD'),
        staleTime: FIVE_MINUTES_MS,
        gcTime: FIVE_MINUTES_MS * 2,
        retry: 1,
    })
}

export function useFeeSchedule() {
    const query = useQuery<FxFeeSchedule>({
        queryKey: ['fx', 'fees'],
        queryFn: fetchFeeSchedule,
        staleTime: FIVE_MINUTES_MS,
        gcTime: FIVE_MINUTES_MS * 2,
        retry: 1,
    })
    return {
        ...query,
        schedule: query.data ?? FALLBACK_FEE_SCHEDULE,
    }
}

export function useReferenceBenchmarks(
    currency: SupportedExchangeCurrency | string | null | undefined,
    enabled = true
) {
    const code = currency?.trim().toUpperCase()
    const supported = !!code && BENCHMARK_CURRENCIES.has(code as SupportedExchangeCurrency)
    return useQuery<FxReferenceBenchmarks | null>({
        queryKey: ['fx', 'reference', code],
        queryFn: () => fetchReferenceBenchmarks(code!),
        enabled: enabled && supported,
        staleTime: FIVE_MINUTES_MS,
        gcTime: FIVE_MINUTES_MS * 2,
        retry: 1,
    })
}
