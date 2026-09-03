'use client'
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

    // tell the shell a header is on screen, so its headerless-state
    // maintenance-banner fallback stays quiet (this header carries the banner)
    useRegisterNavHeader()

    return (
        <div className="w-full">
            <div className="relative flex w-full flex-row items-center justify-between">
                {hideBackBtn ? (
                    <div />
                ) : !onPrev ? (
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
                {!hideLabel && (
                    <div
                        className={twMerge(
                            // board 17343:1781 title is Heading/S. The stock size +
                            // weight pair used here happened to render the same
                            // 24/800/32, but off the token the two drift apart the
                            // moment Heading/S moves.
                            // min-w-max let a long title run under the 40px side buttons
                            // on 360px screens; cap it to the space between them instead
                            'absolute top-1/2 left-1/2 max-w-[calc(100%-8rem)] -translate-x-1/2 -translate-y-1/2 transform truncate pb-1 text-heading-s',
                            titleClassName
                        )}
                    >
                        {label}
                    </div>
                )}

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
            {/* maintenance announcement renders below the nav header (designer
                ruling 2026-09-03) — null outside maintenance mode. The page's
                own px-4 already insets it, so only a top margin here. */}
            <Banner className="mt-2" />
        </div>
    )
}

export default NavHeader
