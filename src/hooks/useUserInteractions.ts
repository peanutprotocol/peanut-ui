import { usersApi } from '@/services/users'
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

const STALE_TIME = 1000 * 60 * 5 // 5 minutes

/**
 * this hook fetches and manages the interaction status for a given set of user ids.
 * it returns a map where each key is a user id and the value is a boolean indicating
 * whether the current user has sent money to that user.
 *
 * @param userIds - an array of user ids to check for interactions.
 * @returns an object containing the interaction status map, loading state, and error state.
 */
export const useUserInteractions = (userIds: string[]) => {
    const {
        data: interactions,
        isLoading,
        isError,
    } = useQuery({
        queryKey: ['userInteractions', userIds],
        queryFn: () => usersApi.getInteractionStatus(userIds),
        enabled: userIds.length > 0, // only run the query if there are user ids to check
        staleTime: STALE_TIME,
    })

    return useMemo(
        () => ({
            interactions: interactions ?? {},
            isLoading,
            isError,
        }),
        [interactions, isLoading, isError]
    )
}
