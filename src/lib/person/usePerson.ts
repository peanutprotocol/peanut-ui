import { useQuery } from '@tanstack/react-query'
import { personFrom } from './person'
import { personQuery } from './personQuery'

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
