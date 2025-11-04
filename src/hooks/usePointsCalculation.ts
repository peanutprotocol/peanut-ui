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
 * @param otherUserId - Optional user ID for P2P transactions (used for handshake bonus calculation)
 * @returns Points data and a ref for the points display element (used for confetti animation)
 */
export const usePointsCalculation = (
    actionType: PointsAction,
    usdAmount: string | null | undefined,
    additionalEnabled: boolean = true,
    uniqueId?: string | number,
    otherUserId?: string
) => {
    const { user } = useAuth()
    const pointsDivRef = useRef<HTMLDivElement>(null)

    // Normalize usdAmount by removing commas (e.g., "1,200.50" -> "1200.50")
    // This handles formatted amounts from inputs that may include thousand separators
    const normalizedUsdAmount = usdAmount?.toString().replace(/,/g, '')
    const parsedUsdAmount = normalizedUsdAmount ? Number(normalizedUsdAmount) : undefined
    const hasValidUsdAmount = parsedUsdAmount !== undefined && !Number.isNaN(parsedUsdAmount) && parsedUsdAmount > 0

    const { data: pointsData } = useQuery({
        queryKey: ['calculate-points', actionType, normalizedUsdAmount, uniqueId, otherUserId],
        queryFn: () =>
            pointsApi.calculatePoints({
                actionType,
                usdAmount: parsedUsdAmount!,
                ...(otherUserId && { otherUserId }),
            }),
        enabled: Boolean(user?.user.userId && hasValidUsdAmount && additionalEnabled),
        refetchOnWindowFocus: false,
        staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    })

    return { pointsData, pointsDivRef }
}
