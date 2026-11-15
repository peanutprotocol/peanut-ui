import { queryClient } from '@/config/queryClient'
import { PERSON } from '@/constants/query.consts'
import { currentAppLocale } from '@/i18n/app/locale-store'
import { apiErrorStatus } from '@/services/api-error'
import { type ApiUser, usersApi } from '@/services/users'

/** One cache entry per handle and language, shared by `usePerson` and the URL
 *  parser. The api localizes the profile's badge copy, so the key carries the
 *  language that api-fetch sends as Accept-Language: a profile fetched before a
 *  language change is never served after it. */
export const personQuery = (username: string) => ({
    queryKey: [PERSON, username.toLowerCase(), currentAppLocale()],
    queryFn: () => usersApi.getByUsername(username.toLowerCase()),
    staleTime: 5 * 60 * 1000,
    // A 4xx (an unknown or deactivated handle) is the answer, so only a 5xx or
    // a network failure is retried.
    retry: (failureCount: number, error: Error) => {
        const status = apiErrorStatus(error)
        return (status === undefined || status >= 500) && failureCount < 2
    },
})

/** Outside React (the URL parser): a fresh fetch every time, because the
 *  answer decides where a payment goes and the API 404s a handle whose owner
 *  has since asked for deletion. It still lands in the cache under the same
 *  key, so the views that follow read this profile with no second request.
 *  Returns the profile because the parser also needs the wallet address. */
export const fetchProfile = (username: string): Promise<ApiUser> =>
    queryClient.fetchQuery({ ...personQuery(username), staleTime: 0 })
