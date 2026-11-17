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
    position,
}: {
    className?: string
    labels: { ios: string; android: string; other: string }
    /** Goes on the click event as `cta_position`. */
    position: CtaPosition
}) {
    const { page, preview, deviceOs } = useCreatorPage()
    const StoreIcon = deviceOs === 'ios' ? AppleLogoIcon : deviceOs === 'android' ? GooglePlayIcon : null

    return (
        <a
            href={page.ctaHref}
            className={className}
            data-cta-position={position}
            onClick={() => {
                // Not awaited: the event leaves as a beacon and the navigation starts at once.
                if (!preview) captureCreatorPageCtaClick(page, position)
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
