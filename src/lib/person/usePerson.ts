import { useQuery } from '@tanstack/react-query'
import { queryClient } from '@/config/queryClient'
import { PERSON } from '@/constants/query.consts'
import { apiErrorStatus } from '@/services/api-error'
import { type ApiUser, usersApi } from '@/services/users'
import { personFrom } from './person'

const personQuery = (username: string) => ({
    queryKey: [PERSON, username.toLowerCase()],
    queryFn: () => usersApi.getByUsername(username.toLowerCase()),
    staleTime: 5 * 60 * 1000,
    // A 4xx (an unknown or deactivated handle) is the answer, so only a 5xx or
    // a network failure is retried.
    retry: (failureCount: number, error: Error) => {
        const status = apiErrorStatus(error)
        return (status === undefined || status >= 500) && failureCount < 2
    },
})

/** The person behind a handle, cached across every surface that asks for it.
 *  `profile` is the full public profile (accounts, badges, isVerified) for the
 *  screens that need more than the Person. */
export function usePerson(username: string | null | undefined) {
    const query = useQuery({ ...personQuery(username ?? ''), enabled: !!username })
    return {
        person: query.data ? personFrom(query.data) : null,
        profile: query.data ?? null,
        isLoading: query.isLoading,
        error: query.error,
    }
}

/** Outside React (the URL parser): same key, same cache. Returns the profile
 *  because the parser also needs the wallet address. */
export const fetchProfile = (username: string): Promise<ApiUser> => queryClient.fetchQuery(personQuery(username))
