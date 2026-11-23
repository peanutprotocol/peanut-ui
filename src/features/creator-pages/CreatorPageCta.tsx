'use client'

import { AppleLogoIcon, GooglePlayIcon } from '@/components/Global/Icons/store-brands'
import { EInviteType } from '@/services/services.types'
import { stashInvite } from '@/utils/invite-stash'
import { captureCreatorPageCtaClick } from './capture-creator-page-events'
import { useCreatorPage } from './CreatorPageContext'
import type { CtaPosition } from './events'
import { creatorInvitePath } from './invite-path'

/**
 * The one button of a creator page. With JavaScript one tap opens the store with the creator as
 * inviter, as the guest button on /invite does. Without it the link opens /invite?code=<username>.
 */
export function CreatorPageCta({
    className,
    labels,
    position,
}: {
    className?: string
    labels: { ios: string; android: string; other: string }
    /** Goes on the click event as `cta_position`. */
    position: CtaPosition
}) {
    const { page, preview, deviceOs, interceptGuestCta } = useCreatorPage()
    const StoreIcon = deviceOs === 'ios' ? AppleLogoIcon : deviceOs === 'android' ? GooglePlayIcon : null

    return (
        <a
            href={creatorInvitePath(page.username)}
            className={className}
            data-cta-position={position}
            onClick={(event) => {
                if (preview) return
                // Not awaited: the event leaves as a beacon and the store opens at once.
                captureCreatorPageCtaClick(page, position)
                // As /invite does for a valid inviter: the stash serves a sign-up in this browser,
                // the explicit `invite` travels in the deferred payload to the app.
                stashInvite(page.username, EInviteType.PAYMENT_LINK)
                if (interceptGuestCta({ invite: page.username })) event.preventDefault()
            }}
        >
            {StoreIcon && (
                // `custom-size` opts out of `.btn svg:not(.custom-size)` in globals.css, which forces 18px
                // and adds a margin. The mark is then 24px, the DS size for a large labelled button,
                // and the page's own gap is the only space between it and the label.
                <StoreIcon width={24} height={24} className="custom-size shrink-0" aria-hidden />
            )}
            <span>{labels[deviceOs]}</span>
        </a>
    )
}
