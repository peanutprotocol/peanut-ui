'use client'
import { useEffect, useState } from 'react'
import { useDeviceType } from '@/hooks/useGetDeviceType'
import { useMigrationFlag } from '@/hooks/useMigrationFlag'
import { isCapacitor } from '@/utils/capacitor'
import { isPwaSunsetPending, storeForDevice } from '@/utils/migration.utils'

/**
 * Whether marketing CTAs send visitors to the app stores. Phones get the store
 * CTA while flags load, so an early tap does not go through web signup first;
 * the signup CTA comes back if the flag loads off. Desktop waits for the flag.
 */
export function useLandingStoreCta(): boolean {
    const migrationOn = useMigrationFlag()
    const { deviceType } = useDeviceType()
    const [mounted, setMounted] = useState(false)
    useEffect(() => setMounted(true), [])
    return migrationOn || (mounted && !!storeForDevice(deviceType) && !isCapacitor() && isPwaSunsetPending())
}
