'use client'

import posthog from 'posthog-js'
import { Button } from '@/components/0_Bruddle/Button'
import { CTA_MOTION } from '@/components/Marketing/constants'
import { STAR_LP_HREF } from '@/components/Marketing/StarLp/starLp.consts'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { MIGRATION_SURFACES } from '@/constants/migration.consts'
import { useAuth } from '@/context/authContext'
import { useGuestStoreHandoff } from '@/hooks/useGuestStoreHandoff'

/**
 * The card CTA, with /shhhhh's routing rather than StarLpCta's: signed-in
 * visitors go straight to /card; with the PWA-sunset flag on, guests get the
 * store (or the desktop QR modal) with /card as the deferred destination.
 * Flag off, guests sign up and land on /card. White secondary on the pink hero.
 * Badge-campaign claims (?campaign=) stay on /shhhhh, where the campaign links point.
 */
export function PeanutCardCta() {
    const { user, isFetchingUser } = useAuth()
    const { interceptGuestCta, storeHandoffModal } = useGuestStoreHandoff({
        surface: MIGRATION_SURFACES.STAR_LP,
        trackImpressionWhenGuest: !isFetchingUser && !user,
    })

    return (
        <>
            <Button
                prefetch={false}
                href={user ? STAR_LP_HREF.cardSignedIn : STAR_LP_HREF.cardGuest}
                variant="secondary"
                size="large"
                className={`w-fit ${CTA_MOTION}`}
                onClick={(event) => {
                    // Wait for auth so a returning user is not sent to the store.
                    if (isFetchingUser) {
                        event.preventDefault()
                        return
                    }
                    posthog.capture(ANALYTICS_EVENTS.CARD_APPLICATION_CTA_CLICKED, {
                        signed_in: !!user,
                        surface: MIGRATION_SURFACES.STAR_LP,
                    })
                    if (!user && interceptGuestCta({ dest: '/card' })) event.preventDefault()
                }}
            >
                Get your virtual card
            </Button>
            {storeHandoffModal}
        </>
    )
}
