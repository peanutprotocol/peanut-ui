'use client'

import { useAuth } from '@/context/authContext'
import { useGeoLocation } from '@/hooks/useGeoLocation'
import { useEffect, useSyncExternalStore } from 'react'
import {
    checkArrival,
    currentArrival,
    currentArrivalGeneration,
    dismissArrival,
    subscribeArrival,
} from './arrival-session'

/**
 * The arrival prompt for the signed-in user (TASK-23251). Home checks once per
 * app session, and again after a native resume from 1 h or more in the
 * background. The check waits for the ipapi fallback, which is cached for 24 h.
 */
export function useArrivalPrompt() {
    const userId = useAuth().user?.user.userId
    const { countryCode: ipCountry, isLoading: ipLoading } = useGeoLocation()
    const arrival = useSyncExternalStore(subscribeArrival, currentArrival, () => null)
    const generation = useSyncExternalStore(subscribeArrival, currentArrivalGeneration, () => 0)

    useEffect(() => {
        if (userId && !ipLoading) void checkArrival(userId, ipCountry)
    }, [userId, ipLoading, ipCountry, generation])

    return { arrival: arrival?.userId === userId ? arrival : null, dismiss: dismissArrival }
}
