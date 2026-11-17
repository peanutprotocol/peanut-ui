'use client'

import { useContext, useEffect, useMemo, type ReactNode } from 'react'
import type { CreatorPageProps } from '@/features/tracked-links/contract'
import { trackedLinkAnalyticsAllowed } from '@/features/tracked-links/eligibility'
import { CreatorPageContext, CreatorPagePreviewContext } from './CreatorPageContext'
import type { DeviceOs } from './environment'
import { expireVariantCookie, serializeVariantCookie } from './variant-cookie'

/** The browser half of CreatorPageShell: it gives the button its data and makes the variant sticky. */
export function CreatorPageProvider({
    page,
    experimentId,
    deviceOs,
    children,
}: {
    page: CreatorPageProps
    /** From the server's experiments.ts: the sticky cookie names the experiment that picked this variant. */
    experimentId: string | null
    deviceOs: DeviceOs
    children: ReactNode
}) {
    const preview = useContext(CreatorPagePreviewContext)
    const context = useMemo(() => ({ page, preview, deviceOs }), [page, preview, deviceOs])

    const { username } = page.creator
    useEffect(() => {
        // A page render cannot set cookies, so the variant becomes sticky here. It follows the
        // consent rule of the visit event: no consent, no cookie, and a fresh pick per visit.
        if (preview || !experimentId) return
        if (trackedLinkAnalyticsAllowed()) {
            document.cookie = serializeVariantCookie(username, { experimentId, variantId: page.variant })
            return
        }
        // Consent can end after a visit that wrote the cookie (an opt-out, or DNT or GPC switched on):
        // remove it, or it would keep the variant for up to 30 days. A prerender is not a refusal,
        // so it leaves the cookie alone.
        if (!(document as Document & { prerendering?: boolean }).prerendering)
            document.cookie = expireVariantCookie(username)
    }, [username, experimentId, page.variant, preview])

    return <CreatorPageContext.Provider value={context}>{children}</CreatorPageContext.Provider>
}
