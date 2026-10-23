'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useSyncExternalStore } from 'react'
import { isDemoMode } from '@/utils/demo'
import { useHydrationSnapshot } from '@/utils/native-platform'
import {
    getKillSwitches,
    hasKillSwitchesAnswered,
    startKillSwitches,
    subscribeKillSwitches,
} from './kill-switches-store'
import { maintenanceRedirectTarget } from './kill-switches.utils'
import { useKillSwitches } from './useKillSwitches'

/**
 * Starts the kill-switch fetches, moves the user to /maintenance while full
 * maintenance is on, and back to /home once the API says it is off. Runs in the
 * app, not in proxy.ts, so the native app (a static export with no server) is
 * covered too.
 */
export function useKillSwitchesSync(): void {
    const router = useRouter()
    const pathname = usePathname()
    const { enableFullMaintenance } = useKillSwitches()
    const demoMode = useHydrationSnapshot(isDemoMode, () => false)
    const answered = useSyncExternalStore(subscribeKillSwitches, hasKillSwitchesAnswered, () => false)

    useEffect(() => startKillSwitches(), [])

    // the hook values only re-run this effect: during hydration they are the server
    // defaults, so the decision reads the live values instead
    useEffect(() => {
        const target = maintenanceRedirectTarget(
            pathname,
            getKillSwitches().enableFullMaintenance,
            isDemoMode(),
            hasKillSwitchesAnswered()
        )
        if (target) router.replace(target)
    }, [pathname, enableFullMaintenance, demoMode, answered, router])
}
