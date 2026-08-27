'use client'

import { useEffect, useState } from 'react'
import { useLocale } from 'next-intl'
import { usePathname } from 'next/navigation'
import { useModalsContext } from '@/context/ModalsContext'
import { useConnectivity } from '@/hooks/useConnectivity'
import { getNotificationPermissionSnapshot } from '@/hooks/useNotifications'
import { getPlatform, isCapacitor } from '@/utils/capacitor'

export interface SupportClientContext {
    platform: string
    /** running build across all three layers: web bundle, native binary, OTA bundle. */
    appBuild: string
    locale: string
    /** route the user was on when they opened support, latched at open. */
    routeOnOpen: string | undefined
    isOffline: boolean
    isApiUnreachable: boolean
    notificationPermission: string
}

/**
 * Which build is this user actually running?
 *
 * Three independent version layers can disagree, and every one of them has
 * produced a support thread about a bug that was already fixed: the web bundle
 * (a document can outlive arbitrarily many deploys — see useStaleDeploymentReload),
 * the native binary, and the Capgo OTA bundle layered on top of it. An agent who
 * can see all three says "update the app" instead of debugging history.
 *
 * Resolved once per session: the native reads are async bridge calls, and the
 * answer cannot change without the app restarting.
 */
const webBuild = () => process.env.NEXT_PUBLIC_GIT_COMMIT_HASH?.slice(0, 7)

let nativeBuildPromise: Promise<string | undefined> | null = null

function resolveNativeBuild(): Promise<string | undefined> {
    if (!nativeBuildPromise) {
        nativeBuildPromise = (async () => {
            const parts: string[] = []
            try {
                const { App } = await import('@capacitor/app')
                const info = await App.getInfo()
                if (info?.version) parts.push(`native:${info.version}${info.build ? ` (${info.build})` : ''}`)
            } catch {
                // older binary, or the bridge isn't up — the web build still prints
            }
            try {
                const { CapacitorUpdater } = await import('@capgo/capacitor-updater')
                const current = await CapacitorUpdater.current()
                if (current?.bundle?.version) parts.push(`ota:${current.bundle.version}`)
            } catch {
                // no OTA layer on this install
            }
            return parts.length ? parts.join(' ') : undefined
        })()
        nativeBuildPromise.catch(() => {
            nativeBuildPromise = null
        })
    }
    return nativeBuildPromise
}

export function useSupportClientContext(): SupportClientContext {
    const locale = useLocale()
    const pathname = usePathname()
    const { isSupportModalOpen } = useModalsContext()
    const { isOffline, isApiUnreachable } = useConnectivity()
    const [nativeBuild, setNativeBuild] = useState<string | undefined>(undefined)

    useEffect(() => {
        if (!isCapacitor()) return
        let cancelled = false
        resolveNativeBuild().then((build) => {
            if (!cancelled) setNativeBuild(build)
        })
        return () => {
            cancelled = true
        }
    }, [])

    /*
     * The route is latched at open rather than tracked live. Live-tracking would
     * churn the whole snapshot's identity on every navigation — and the question
     * an agent is asking ("where were they when this went wrong?") is answered by
     * the screen the user left, not the one they wandered to while waiting.
     */
    const [routeOnOpen, setRouteOnOpen] = useState<string | undefined>(undefined)
    useEffect(() => {
        if (isSupportModalOpen) setRouteOnOpen(pathname)
        // eslint-disable-next-line react-hooks/exhaustive-deps -- latch at open; tracking `pathname` would defeat the point
    }, [isSupportModalOpen])

    const buildParts = [webBuild() ? `web:${webBuild()}` : undefined, nativeBuild].filter(Boolean)

    return {
        platform: getPlatform(),
        appBuild: buildParts.length ? buildParts.join(' · ') : 'unknown',
        locale,
        routeOnOpen,
        isOffline,
        isApiUnreachable,
        notificationPermission: getNotificationPermissionSnapshot(),
    }
}
