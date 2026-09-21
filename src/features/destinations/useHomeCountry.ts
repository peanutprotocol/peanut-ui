'use client'
import { useOptionalAuth } from '@/context/authContext'
import { useGeoLocation } from '@/hooks/useGeoLocation'

/**
 * The country to put at the top of a country list: the one KYC confirmed the
 * user lives in, and the IP lookup only when there is no confirmed one. A
 * verified residence is what the money rails are bound to, and it survives a
 * trip abroad or a VPN — both of which move the IP answer.
 *
 * `isLoading` still tracks the IP lookup, because the list waits on it only
 * when it has nothing better; a known residence answers on the first frame.
 */
export function useHomeCountry(): { countryCode: string | null; isLoading: boolean } {
    const user = useOptionalAuth()?.user
    const geo = useGeoLocation()
    const residence = user?.residence?.verified ?? null
    if (residence) return { countryCode: residence.toUpperCase(), isLoading: false }
    return { countryCode: geo.countryCode, isLoading: geo.isLoading }
}
