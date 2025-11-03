import { useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { pointsApi } from '@/services/points'
import { PointsAction } from '@/services/services.types'
import { useAuth } from '@/context/authContext'

/**
 * Hook to fetch and calculate points for various actions
 * @param actionType - The type of action earning points (e.g., MANTECA_QR_PAYMENT, MANTECA_TRANSFER)
 * @param usdAmount - The USD amount for the transaction
 * @param additionalEnabled - Additional condition to enable the query (e.g., payment processor check)
 * @param uniqueId - Optional unique identifier to prevent cache collisions between different transactions (e.g., payment ID, timestamp)
 * @returns Points data and a ref for the points display element (used for confetti animation)
 */
export const usePointsCalculation = (
    actionType: PointsAction,
    usdAmount: string | null | undefined,
    additionalEnabled: boolean = true,
    uniqueId?: string | number
) => {
    const { user } = useAuth()
    const pointsDivRef = useRef<HTMLDivElement>(null)

    const { data: pointsData } = useQuery({
        queryKey: ['calculate-points', actionType, usdAmount, uniqueId],
        queryFn: () =>
            pointsApi.calculatePoints({
                actionType,
                usdAmount: Number(usdAmount),
            }),
        enabled: !!(user?.user.userId && usdAmount && Number(usdAmount) > 0 && additionalEnabled),
        refetchOnWindowFocus: false,
        staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    })

    return { pointsData, pointsDivRef }
}
