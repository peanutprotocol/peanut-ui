'use client'

import { useQuery } from '@tanstack/react-query'
import { cardApi, type CardInfoResponse } from '@/services/card'
import { useAuth } from '@/context/authContext'

export const useCardInfo = () => {
    const { user } = useAuth()

    const query = useQuery<CardInfoResponse>({
        queryKey: ['card-info', user?.user?.userId],
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
        // Convenience booleans - return undefined while loading to prevent flash
        isEligible: query.isLoading ? undefined : (query.data?.isEligible ?? false),
    }
}
