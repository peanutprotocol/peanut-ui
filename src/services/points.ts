import { TierInfo } from './services.types'

export const pointsApi = {
    getTierInfo: async (): Promise<{ success: boolean; data: TierInfo }> => {
        // Add 2 second delay
        await new Promise((resolve) => setTimeout(resolve, 2000))

        const response = {
            userId: 'user_123',
            directPoints: 2500,
            transitivePoints: 850,
            totalPoints: 3350,
            currentTier: 2,
            leaderboardRank: 42,
            nextTierThreshold: 10000,
            pointsToNextTier: 6650,
        }

        return {
            success: true,
            data: response,
        }
    },
}
