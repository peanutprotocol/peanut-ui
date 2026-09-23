'use client'
import { useOptionalAuth } from '@/context/authContext'
import { useGeoLocation } from '@/hooks/useGeoLocation'

/**
 * The country to put at the top of a country list: the one KYC confirmed the
 * user lives in, and the IP lookup only when there is no confirmed one. A
 * verified residence is what the money rails are bound to, and it survives a
 * trip abroad or a VPN — both of which move the IP answer.
 *
 * The IP answer can arrive late or never. Callers render without it and let it
 * re-sort when it comes (TASK-22967), so this returns no loading flag.
 */
export function useHomeCountry(): { countryCode: string | null } {
    const user = useOptionalAuth()?.user
    const geo = useGeoLocation()
    const residence = user?.residence?.verified ?? null
    if (residence) return { countryCode: residence.toUpperCase() }
    return { countryCode: geo.countryCode }
}
