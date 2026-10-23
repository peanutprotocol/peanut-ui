'use client'

import { useRouter } from 'next/navigation'
import posthog from 'posthog-js'
import { useEffect, useState, type MouseEvent } from 'react'
import { STAR_LP_HREF } from '@/components/Marketing/StarLp/starLp.consts'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { MIGRATION_SURFACES } from '@/constants/migration.consts'
import { useAuth } from '@/context/authContext'
import { useGuestStoreHandoff } from '@/hooks/useGuestStoreHandoff'
import type { PeanutCardCtaPlacement } from './peanutCard.types'

/**
 * The card CTA's routing, shared by the buttons and the hero card: signed-in
 * visitors go straight to /card; with the PWA-sunset flag on, guests get the
 * store (or the desktop QR modal) with /card as the deferred destination.
 * Flag off, guests sign up and land on /card. A click while auth is still
 * loading is queued and runs when it settles, so a returning user is not sent
 * to the store and a tap is never dead. Render `storeHandoffModal` beside the link.
 */
export function usePeanutCardCta(placement: PeanutCardCtaPlacement) {
    const router = useRouter()
    const { user, isFetchingUser } = useAuth()
    const { interceptGuestCta, storeHandoffModal } = useGuestStoreHandoff({
        surface: MIGRATION_SURFACES.STAR_LP,
        trackImpressionWhenGuest: placement === 'hero' && !isFetchingUser && !user,
    })
    const [queued, setQueued] = useState(false)
    const href = user ? STAR_LP_HREF.cardSignedIn : STAR_LP_HREF.cardGuest

    // Returns true when the click was handled here and the link must not navigate.
    const go = (): boolean => {
        posthog.capture(ANALYTICS_EVENTS.CARD_APPLICATION_CTA_CLICKED, {
            signed_in: !!user,
            surface: MIGRATION_SURFACES.STAR_LP,
            placement,
        })
        return !user && interceptGuestCta({ dest: '/card' })
    }

    useEffect(() => {
        if (!queued || isFetchingUser) return
        setQueued(false)
        if (!go()) router.push(href)
        // `go` and `href` are read fresh on the render where auth settles.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [queued, isFetchingUser])

    const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
        if (isFetchingUser) {
            event.preventDefault()
            setQueued(true)
            return
        }
        if (go()) event.preventDefault()
    }

    return { href, onClick, queued, storeHandoffModal }
}
