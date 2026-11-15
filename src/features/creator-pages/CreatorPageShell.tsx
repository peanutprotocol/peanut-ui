'use client'

import { useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from 'react'
import { trackedLinkAnalyticsAllowed } from '@/features/tracked-links/eligibility'
import { CreatorPageContext, CreatorPagePreviewContext } from './CreatorPageContext'
import { deviceOs, type DeviceOs } from './environment'
import { creatorPageExperimentId } from './experiment-ids'
import type { CreatorPageProps } from './types'
import { serializeVariantCookie } from './variant-cookie'

const subscribeToNothing = () => () => {}
const clientDeviceOs = (): DeviceOs => deviceOs(navigator.userAgent)
const serverDeviceOs = (): DeviceOs => 'other'

/**
 * The root element of every creator page variant. It sends no view event: the engine's
 * tracked_link_visit is the only view count (go-links contract v1).
 */
export function CreatorPageShell({
    page,
    lang,
    className,
    children,
}: {
    page: CreatorPageProps
    lang: string
    className?: string
    children: ReactNode
}) {
    const preview = useContext(CreatorPagePreviewContext)
    // The server render has no user agent, so hydration starts from `other` and corrects itself without a mismatch.
    const os = useSyncExternalStore(subscribeToNothing, clientDeviceOs, serverDeviceOs)
    const context = useMemo(() => ({ page, preview, deviceOs: os }), [page, preview, os])

    const { username } = page.creator
    useEffect(() => {
        // A page render cannot set cookies, so the variant becomes sticky here. It follows the
        // consent rule of the visit event: no consent, no cookie, and a fresh pick per visit.
        const experimentId = creatorPageExperimentId(username)
        if (preview || !experimentId || !trackedLinkAnalyticsAllowed()) return
        document.cookie = serializeVariantCookie(username, { experimentId, variantId: page.variant })
    }, [username, page.variant, preview])

    return (
        <CreatorPageContext.Provider value={context}>
            <main lang={lang} className={className}>
                {children}
            </main>
        </CreatorPageContext.Provider>
    )
}
