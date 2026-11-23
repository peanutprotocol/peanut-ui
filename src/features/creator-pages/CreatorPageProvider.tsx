'use client'

import { useContext, useEffect, useRef, type ReactNode } from 'react'
import { useGuestStoreHandoff } from '@/hooks/useGuestStoreHandoff'
import { captureCreatorPageView } from './capture-creator-page-events'
import { creatorPageAnalyticsAllowed } from './consent'
import { CreatorPageContext, CreatorPagePreviewContext } from './CreatorPageContext'
import type { DeviceOs } from './environment'
import type { CreatorPageProps } from './types'
import { expireVariantCookie, serializeVariantCookie } from './variant-cookie'

/**
 * The browser half of CreatorPageShell: it counts the view, makes the variant sticky and owns the
 * store hand-off (and its desktop QR modal) that every button of the page uses.
 */
export function CreatorPageProvider({
    page,
    deviceOs,
    children,
}: {
    page: CreatorPageProps
    deviceOs: DeviceOs
    children: ReactNode
}) {
    const preview = useContext(CreatorPagePreviewContext)
    // The same hand-off as a guest on /invite: a phone goes to its store with the inviter in the
    // deferred payload, a desktop gets the QR modal.
    const { interceptGuestCta, storeHandoffModal } = useGuestStoreHandoff()
    // A new value on each render: this renders again only when the QR modal opens or closes.
    const context = { page, preview, deviceOs, interceptGuestCta }

    const viewSent = useRef(false)
    const { username, experimentId, variant } = page
    useEffect(() => {
        if (preview) return
        if (!viewSent.current) {
            viewSent.current = true
            captureCreatorPageView(page)
        }
        // A page render cannot set cookies, so the variant becomes sticky here. It follows the
        // consent rule of the events: no consent, no cookie, and a fresh pick per visit.
        if (creatorPageAnalyticsAllowed()) {
            document.cookie = serializeVariantCookie(username, { experimentId, variantId: variant })
            return
        }
        // Consent can end after a visit that wrote the cookie (an opt-out, or DNT or GPC switched on):
        // remove it, or it would keep the variant for up to 30 days. A prerender is not a refusal,
        // so it leaves the cookie alone.
        if (!(document as Document & { prerendering?: boolean }).prerendering)
            document.cookie = expireVariantCookie(username)
        // `page` is the same object for the life of the page; its fields are the real dependencies.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [username, experimentId, variant, preview])

    return (
        <CreatorPageContext.Provider value={context}>
            {children}
            {storeHandoffModal}
        </CreatorPageContext.Provider>
    )
}
