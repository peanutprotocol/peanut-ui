'use client'

import { useContext, useEffect, useMemo, type ReactNode } from 'react'
import type { CreatorPageProps } from '@/features/tracked-links/contract'
import { trackedLinkAnalyticsAllowed } from '@/features/tracked-links/eligibility'
import { CreatorPageContext, CreatorPagePreviewContext } from './CreatorPageContext'
import type { DeviceOs } from './environment'
import { serializeVariantCookie } from './variant-cookie'

/** The browser half of CreatorPageShell: it gives the button its data and makes the variant sticky. */
export function CreatorPageProvider({
    page,
    experimentId,
    deviceOs,
    children,
}: {
    page: CreatorPageProps
    experimentId: string | null
    deviceOs: DeviceOs
    children: ReactNode
}) {
    const preview = useContext(CreatorPagePreviewContext)
    const context = useMemo(() => ({ page, experimentId, preview, deviceOs }), [page, experimentId, preview, deviceOs])

    const { username } = page.creator
    useEffect(() => {
        // A page render cannot set cookies, so the variant becomes sticky here. It follows the
        // consent rule of the visit event: no consent, no cookie, and a fresh pick per visit.
        if (preview || !experimentId || !trackedLinkAnalyticsAllowed()) return
        document.cookie = serializeVariantCookie(username, { experimentId, variantId: page.variant })
    }, [username, experimentId, page.variant, preview])

    return <CreatorPageContext.Provider value={context}>{children}</CreatorPageContext.Provider>
}
