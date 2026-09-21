'use client'
import { useRef } from 'react'
import { useTranslations } from 'next-intl'
// type-only: erased at build, so the catalog is not bundled here
import type enMessages from '@/i18n/app/messages/en.json'
import { Button } from '@/components/0_Bruddle/Button'
import { twMerge } from '@/utils/tw'
import { Icon, type IconName } from '../Icons/Icon'
import { Banner } from '@/components/Global/Banner'
import { useRegisterNavHeader } from '@/components/Global/Banner/navHeaderPresence'
import { NAV_CIRCLE_BUTTON_CLASSES } from './navHeader.consts'

export interface NavHeaderProps {
    onPrev?: () => void
    disableBackBtn?: boolean
    title?: string
    /** Localized title for callers that cannot call useTranslations — i.e. server
     *  components, since this app has no server-side next-intl setup (locale is
     *  resolved entirely client-side by AppIntlProvider). Resolved against the
     *  `navigation` namespace. Prefer plain `title` from client components. */
    titleKey?: keyof typeof enMessages.navigation
    href?: string
    hideLabel?: boolean
    icon?: IconName
    titleClassName?: string
    /** trailing slot (board navigation.top.trailing) — step indicators, actions */
    rightElement?: React.ReactNode
    /** render no back button at all (board navigation.top.trailing.*) —
     *  ex-FlowHeader flows that hid the button on step 1 */
    hideBackBtn?: boolean
    /** opt out of the maintenance banner mount — for overlay/marketing navs
     *  (HeroBackNav floats this header over a hero; a banner inside that
     *  absolute container covers the page, and marketing/shhhhh must show no
     *  maintenance notice at all — ruled 2026-09-03). */
    hideMaintenanceBanner?: boolean
}

const NavHeader = ({
    title,
    titleKey,
    icon = 'chevron-up',
    href,
    hideLabel = false,
    onPrev,
    disableBackBtn,
    titleClassName,
    rightElement,
    hideBackBtn = false,
    hideMaintenanceBanner = false,
}: NavHeaderProps) => {
    const tNav = useTranslations('navigation')
    const tCommon = useTranslations('common')
    const label = title ?? (titleKey ? tNav(titleKey) : undefined)

    // tell the shell a VISIBLE header is on screen, so its headerless-state
    // maintenance-banner fallback stays quiet (this header carries the banner)
    const rootRef = useRef<HTMLDivElement>(null)
    useRegisterNavHeader(rootRef, hideMaintenanceBanner)

    return (
        <div className="w-full" ref={rootRef}>
            {/* Fixed side columns keep both controls at the navigation origin.
                The center column stays clear of their 40px visuals plus a 24px
                gap, and grows DOWN for translated titles that need more than one
                line; absolute centering made a wrapped title grow into the safe
                area and did not contribute height to the page stack. */}
            <div className="grid w-full grid-cols-[2.5rem_minmax(0,1fr)_2.5rem] items-start gap-x-6">
                <div className="col-start-1 row-start-1">
                    {hideBackBtn ? null : !onPrev ? (
                        // link-mode Button: one anchor, no Link>Button nested interactive
                        <Button
                            variant="stroke"
                            href={href ?? '/home'}
                            className={NAV_CIRCLE_BUTTON_CLASSES}
                            aria-label={tCommon('back')}
                            data-testid="nav-back"
                        >
                            <Icon
                                name={icon}
                                size={20}
                                className={twMerge(icon === 'chevron-up' && '-rotate-90') || undefined}
                            />
                        </Button>
                    ) : (
                        <Button
                            variant="stroke"
                            className={NAV_CIRCLE_BUTTON_CLASSES}
                            onClick={onPrev}
                            disabled={disableBackBtn}
                            aria-label={tCommon('back')}
                            data-testid="nav-back"
                        >
                            <Icon
                                name={icon}
                                size={20}
                                className={twMerge(icon === 'chevron-up' && '-rotate-90') || undefined}
                            />
                        </Button>
                    )}
                </div>
                {!hideLabel && (
                    <div
                        className={twMerge(
                            // board 17343:1781 title is Heading/S. The stock size +
                            // weight pair used here happened to render the same
                            // 24/800/32, but off the token the two drift apart the
                            // moment Heading/S moves.
                            'col-start-2 row-start-1 min-w-0 pt-0.5 pb-1 text-center text-heading-s break-words whitespace-normal',
                            titleClassName
                        )}
                    >
                        {label}
                    </div>
                )}
                <div className="col-start-3 row-start-1 flex justify-end gap-3">{rightElement}</div>
            </div>
            {/* maintenance announcement renders below the nav header (designer
                ruling 2026-09-03) — null outside maintenance mode. The page's
                own px-4 already insets it. Gap: section gap XL/24 (`mt-6`,
                spacing board 17291:2772) — the banner is a block in the page
                stack, same rhythm as PageStack's gap-6. */}
            {!hideMaintenanceBanner && <Banner variant="feature" className="mt-6" />}
        </div>
    )
}

export default NavHeader
