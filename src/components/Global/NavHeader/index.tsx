'use client'
import { useRef } from 'react'
import { useTranslations } from 'next-intl'
// type-only: erased at build, so the catalog is not bundled here
import type enMessages from '@/i18n/app/messages/en.json'
import { Button } from '@/components/0_Bruddle/Button'
import Link from 'next/link'
import { twMerge } from '@/utils/tw'
import { Icon, type IconName } from '../Icons/Icon'
import { useAuth } from '@/context/authContext'
import { Banner } from '@/components/Global/Banner'
import { useRegisterNavHeader } from '@/components/Global/Banner/navHeaderPresence'

interface NavHeaderProps {
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
    showLogoutBtn?: boolean
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

// board 17802:61534 top-nav circle button: 40px visual, no shadow, pseudo-element
// extends the hit area to 44px (touch-target law — was 28px, the "opened support
// instead of going back" bug)
const navCircleBtn = 'relative size-10 w-10 p-0 shadow-none after:absolute after:-inset-0.5'

const NavHeader = ({
    title,
    titleKey,
    icon = 'chevron-up',
    href,
    hideLabel = false,
    onPrev,
    disableBackBtn,
    showLogoutBtn = false,
    titleClassName,
    rightElement,
    hideBackBtn = false,
    hideMaintenanceBanner = false,
}: NavHeaderProps) => {
    // marketing routes mount NavHeader without the app provider tree, where
    // useAuth throws by design. Auth only feeds the logout button, so "no
    // provider" just hides it. try/catch, not a separate optional hook: the
    // hook still runs unconditionally, and every test that mocks useAuth
    // keeps working without also having to mock a second export.
    let auth: ReturnType<typeof useAuth> | undefined
    try {
        // eslint-disable-next-line react-hooks/rules-of-hooks -- not conditional: the hook body (useContext) always executes in the same order; only its provider-missing throw is caught
        auth = useAuth()
    } catch {
        auth = undefined
    }
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
                        <Link href={href ?? '/home'}>
                            <Button
                                variant="stroke"
                                className={navCircleBtn}
                                aria-label={tCommon('back')}
                                data-testid="nav-back"
                            >
                                <Icon
                                    name={icon}
                                    size={20}
                                    className={twMerge(icon === 'chevron-up' && '-rotate-90') || undefined}
                                />
                            </Button>
                        </Link>
                    ) : (
                        <Button
                            variant="stroke"
                            className={navCircleBtn}
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
                <div className="col-start-3 row-start-1 flex justify-end gap-3">
                    {rightElement}
                    {showLogoutBtn && auth && (
                        <Button
                            onClick={() => auth.logoutUser()}
                            loading={auth.isLoggingOut}
                            variant="stroke"
                            icon="logout"
                            aria-label={tNav('logout')}
                            className={navCircleBtn}
                        />
                    )}
                </div>
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
