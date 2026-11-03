import { queryClient } from '@/config/queryClient'
import { PERSON } from '@/constants/query.consts'
import { apiErrorStatus } from '@/services/api-error'
import { type ApiUser, usersApi } from '@/services/users'

/** One cache entry per handle, shared by `usePerson` and the URL parser. */
export const personQuery = (username: string) => ({
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

/** Outside React (the URL parser): same key, same cache. Returns the profile
 *  because the parser also needs the wallet address. */
export const fetchProfile = (username: string): Promise<ApiUser> => queryClient.fetchQuery(personQuery(username))
