/**
 * Quest data fetching hooks using TanStack Query
 * Provides caching and automatic refetching for quest leaderboards
 */

import { useQuery } from '@tanstack/react-query'
import { questsApi } from '@/services/quests'
import { getQuestStatus } from '../constants'

export function useAllQuestsLeaderboards(limit: number = 3, useTestTimePeriod: boolean = false) {
    const questStatus = getQuestStatus()
    const isEnabled = useTestTimePeriod || questStatus !== 'not_started'

    return useQuery({
        queryKey: ['quests', 'all-leaderboards', limit, useTestTimePeriod],
        queryFn: async () => {
            const result = await questsApi.getAllLeaderboards({ limit, useTestTimePeriod })
            if (!result.success) {
                throw new Error(result.error || 'Failed to fetch leaderboards')
            }
            return result.data
        },
        enabled: isEnabled,
        staleTime: 5 * 60 * 1000, // 5 minutes (matches backend cache)
        refetchInterval: 5 * 60 * 1000,
    })
}

export function useQuestLeaderboard(
    questId: 'most_invites' | 'bank_drainer' | 'biggest_pot',
    limit: number = 10,
    useTestTimePeriod: boolean = false
) {
    const questStatus = getQuestStatus()
    const isEnabled = useTestTimePeriod || questStatus !== 'not_started'

    return useQuery({
        queryKey: ['quests', questId, 'leaderboard', limit, useTestTimePeriod],
        queryFn: async () => {
            const result = await questsApi.getQuestLeaderboard(questId, { limit, useTestTimePeriod })
            if (!result.success) {
                throw new Error(result.error || 'Failed to fetch leaderboard')
            }
            return result.data
        },
        enabled: isEnabled,
        staleTime: 5 * 60 * 1000, // 5 minutes (matches backend cache)
        refetchInterval: 5 * 60 * 1000,
    })
}
