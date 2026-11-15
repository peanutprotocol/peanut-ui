'use client'

import { AppleLogoIcon, GooglePlayIcon } from '@/components/Global/Icons/store-brands'
import { captureCreatorPageCtaClick } from './capture-creator-page-cta-click'
import { useCreatorPage } from './CreatorPageContext'
import type { CtaPosition } from './events'

/**
 * The one button of a creator page. The engine owns `ctaHref`; when one-tap iOS lands
 * (go-links plumbing PR 5) the engine's button replaces the link here and nowhere else.
 */
export function CreatorPageCta({
    className,
    labels,
    showStoreIcon = false,
    position,
}: {
    className?: string
    labels: { ios: string; android: string; other: string }
    showStoreIcon?: boolean
    /** Goes on the click event as `cta_position`, for a variant that renders the button more than once. */
    position?: CtaPosition
}) {
    const { page, preview, deviceOs } = useCreatorPage()
    const StoreIcon = deviceOs === 'ios' ? AppleLogoIcon : deviceOs === 'android' ? GooglePlayIcon : null

    return (
        <a
            href={page.ctaHref}
            className={className}
            data-cta-position={position}
            onClick={() => {
                // Not awaited: PostHog queues the event and the navigation starts at once.
                if (!preview) captureCreatorPageCtaClick(page, position)
            }}
        >
            {showStoreIcon && StoreIcon && <StoreIcon width="1.25em" height="1.25em" aria-hidden />}
            <span>{labels[deviceOs]}</span>
        </a>
    )
}
