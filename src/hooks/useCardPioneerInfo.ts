'use client'

import { useQuery } from '@tanstack/react-query'
import { cardApi, type CardInfoResponse } from '@/services/card'
import { useAuth } from '@/context/authContext'

/**
 * Hook to fetch Card Pioneer info for the authenticated user.
 * Returns eligibility status, purchase status, and pricing.
 */
export const useCardPioneerInfo = () => {
    const { user } = useAuth()

    const query = useQuery<CardInfoResponse>({
        queryKey: ['card-info'],
        queryFn: () => cardApi.getInfo(),
        enabled: !!user?.user?.userId,
        staleTime: 60_000, // 1 minute
        retry: 1,
    })

    return {
        cardInfo: query.data,
        isLoading: query.isLoading,
        error: query.error,
        refetch: query.refetch,
        // Convenience booleans
        isEligible: query.data?.isEligible ?? false,
        hasPurchased: query.data?.hasPurchased ?? false,
        price: query.data?.price ?? 10,
    }
}
