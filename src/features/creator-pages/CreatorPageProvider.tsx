'use client'

import posthog from 'posthog-js'
import { useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { MIGRATION_SURFACES } from '@/constants/migration.consts'
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
    // True once the visitor sees the page (after hydration, or after a prerender is activated) and
    // analytics are allowed.
    const [countImpression, setCountImpression] = useState(false)
    // The same hand-off as a guest on /invite: a phone goes to its store with the inviter in the
    // deferred payload, a desktop gets the QR modal. Its own surface, with an impression, keeps
    // creator-page taps out of the guest_flow click-through rate. The impression waits until the
    // page is shown with consent, so a prerender nobody opens, or a refusal, counts no CTA.
    const { interceptGuestCta, storeHandoffModal } = useGuestStoreHandoff({
        surface: MIGRATION_SURFACES.CREATOR_PAGE,
        trackImpressionWhenGuest: !preview && countImpression,
    })
    // A new value on each render: this renders again only when the QR modal opens or closes.
    const context = { page, preview, deviceOs, interceptGuestCta }

    // The store hand-off (shared with /invite) captures its own events on a tap: the store click,
    // the deferred hand-off and, on a desktop, the QR modal. While this page is mounted PostHog
    // drops every event under Do Not Track or Global Privacy Control, so none of them bypasses the
    // consent rule of the creator events. A PostHog opt-out and a build without a key already send
    // nothing. Navigation and the invite payload do not depend on capture.
    useEffect(() => {
        if (preview) return undefined
        const previous = posthog.config?.respect_dnt ?? false
        posthog.set_config({ respect_dnt: true })
        return () => posthog.set_config({ respect_dnt: previous })
    }, [preview])

    const viewSent = useRef(false)
    const { username, experimentId, variant } = page
    useEffect(() => {
        if (preview) return undefined
        const doc = document as Document & { prerendering?: boolean }
        const activate = () => {
            // A page render cannot set cookies, so the variant becomes sticky here. It follows the
            // consent rule of the events: no consent, no event, no cookie, and a fresh pick per visit.
            if (creatorPageAnalyticsAllowed()) {
                setCountImpression(true)
                if (!viewSent.current) {
                    viewSent.current = true
                    captureCreatorPageView(page)
                }
                document.cookie = serializeVariantCookie(username, { experimentId, variantId: variant })
                return
            }
            // Consent can end after a visit that wrote the cookie (an opt-out, or DNT or GPC switched on):
            // remove it, or it would keep the variant for up to 30 days.
            document.cookie = expireVariantCookie(username)
        }
        // A prerender is not a visit: wait until the visitor sees the page, as the marketing QR
        // handoff does. Activation does not rerun this effect, so the listener does the work.
        if (doc.prerendering) {
            doc.addEventListener('prerenderingchange', activate, { once: true })
            return () => doc.removeEventListener('prerenderingchange', activate)
        }
        activate()
        return undefined
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
