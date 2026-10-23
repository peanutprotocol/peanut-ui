'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { startKillSwitches } from './kill-switches-store'
import { isDemoMode } from '@/utils/demo'
import { useHydrationSnapshot } from '@/utils/native-platform'
import { maintenanceRedirectTarget } from './kill-switches.utils'
import { useKillSwitches } from './useKillSwitches'

/**
 * Starts the kill-switch fetches, moves the user to /maintenance while full
 * maintenance is on, and back to /home once it is off. Runs in the app, not in proxy.ts, so the native app (a
 * static export with no server) is covered too.
 */
export function useKillSwitchesSync(): void {
    const router = useRouter()
    const pathname = usePathname()
    const { enableFullMaintenance } = useKillSwitches()
    const demoMode = useHydrationSnapshot(isDemoMode, () => false)

    useEffect(() => startKillSwitches(), [])

    useEffect(() => {
        const target = maintenanceRedirectTarget(pathname, enableFullMaintenance, demoMode)
        if (target) router.replace(target)
    }, [pathname, enableFullMaintenance, demoMode, router])
}
