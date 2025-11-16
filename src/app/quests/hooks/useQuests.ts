/**
 * Quest data fetching hooks using TanStack Query
 * Provides caching and automatic refetching for quest leaderboards
 */

import { useQuery } from '@tanstack/react-query'
import { questsApi } from '@/services/quests'
import { getQuestStatus } from '../constants'

// Mock data generator for testing and development
function generateMockLeaderboard(limit: number, baseMetric: number = 100) {
    return Array.from({ length: limit }, (_, i) => ({
        rank: i + 1,
        userId: `debug-user-${i + 1}`,
        username: `user${i + 1}`,
        metric: baseMetric - i * 5,
        badge: i === 0 ? 'GOLD' : i === 1 ? 'SILVER' : i === 2 ? 'BRONZE' : undefined,
    }))
}

function getMockAllLeaderboards(limit: number) {
    return {
        most_invites: {
            leaderboard: generateMockLeaderboard(limit, 50),
            userStatus: { metric: 12 },
        },
        bank_drainer: {
            leaderboard: generateMockLeaderboard(limit, 2500),
            userStatus: { metric: 500 },
        },
        biggest_pot: {
            leaderboard: generateMockLeaderboard(limit, 35),
            userStatus: { metric: 8 },
        },
    }
}

export function useAllQuestsLeaderboards(
    limit: number = 3,
    useMockData: boolean = false,
    useTestTimePeriod: boolean = false
) {
    const questStatus = getQuestStatus()
    // Enable query if using mock data OR test period OR if quest has started
    const isEnabled = useMockData || useTestTimePeriod || questStatus !== 'not_started'

    return useQuery({
        queryKey: ['quests', 'all-leaderboards', limit, useMockData, useTestTimePeriod],
        queryFn: async () => {
            // Return mock data if useMockData is enabled
            if (useMockData) {
                // Add a small delay to simulate API call
                await new Promise((resolve) => setTimeout(resolve, 300))
                return getMockAllLeaderboards(limit)
            }

            const result = await questsApi.getAllLeaderboards({ limit, useTestTimePeriod })
            if (!result.success) {
                throw new Error(result.error || 'Failed to fetch leaderboards')
            }
            return result.data
        },
        enabled: isEnabled,
        staleTime: 5 * 60 * 1000, // 5 minutes (matches backend cache)
        refetchInterval: useMockData ? false : 5 * 60 * 1000,
    })
}

export function useQuestLeaderboard(
    questId: 'most_invites' | 'bank_drainer' | 'biggest_pot',
    limit: number = 10,
    useMockData: boolean = false,
    useTestTimePeriod: boolean = false
) {
    const questStatus = getQuestStatus()
    // Enable query if using mock data OR test period OR if quest has started
    const isEnabled = useMockData || useTestTimePeriod || questStatus !== 'not_started'

    return useQuery({
        queryKey: ['quests', questId, 'leaderboard', limit, useMockData, useTestTimePeriod],
        queryFn: async () => {
            // Return mock data if useMockData is enabled
            if (useMockData) {
                // Add a small delay to simulate API call
                await new Promise((resolve) => setTimeout(resolve, 300))
                const mockData = getMockAllLeaderboards(limit)
                return mockData[questId]
            }

            const result = await questsApi.getQuestLeaderboard(questId, { limit, useTestTimePeriod })
            if (!result.success) {
                throw new Error(result.error || 'Failed to fetch leaderboard')
            }
            return result.data
        },
        enabled: isEnabled,
        staleTime: 5 * 60 * 1000, // 5 minutes (matches backend cache)
        refetchInterval: useMockData ? false : 5 * 60 * 1000,
    })
}
