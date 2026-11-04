import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { personFrom } from './person'
import { personQuery } from './personQuery'

/** The person behind a handle, cached across every surface that asks for it.
 *  `profile` is the full public profile (accounts, badges, isVerified) for the
 *  screens that need more than the Person. */
export function usePerson(username: string | null | undefined) {
    const query = useQuery({ ...personQuery(username ?? ''), enabled: !!username })
    const profile = query.data ?? null
    // One Person per profile object, so a caller can put it in a dependency list.
    const person = useMemo(() => personFrom(profile), [profile])
    return { person, profile, isLoading: query.isLoading, error: query.error }
}
