'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { startKillSwitches } from './kill-switches-store'
import { shouldRedirectToMaintenance } from './kill-switches.utils'
import { useKillSwitches } from './useKillSwitches'

/**
 * Starts the kill-switch fetches and moves the user to /maintenance while full
 * maintenance is on. Runs in the app, not in proxy.ts, so the native app (a
 * static export with no server) is covered too.
 */
export function useKillSwitchesSync(): void {
    const router = useRouter()
    const pathname = usePathname()
    const { enableFullMaintenance } = useKillSwitches()

    useEffect(() => startKillSwitches(), [])

    useEffect(() => {
        if (shouldRedirectToMaintenance(pathname, enableFullMaintenance)) router.replace('/maintenance')
    }, [pathname, enableFullMaintenance, router])
}
