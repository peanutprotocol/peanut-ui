'use client'
import { useTranslations } from 'next-intl'
// type-only: erased at build, so the catalog is not bundled here
import type enMessages from '@/i18n/app/messages/en.json'
import { Button } from '@/components/0_Bruddle/Button'
import Link from 'next/link'
import { twMerge } from 'tailwind-merge'
import { Icon, type IconName } from '../Icons/Icon'
import { useAuth } from '@/context/authContext'

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
}: NavHeaderProps) => {
    const { logoutUser, isLoggingOut } = useAuth()
    const tNav = useTranslations('navigation')
    const label = title ?? (titleKey ? tNav(titleKey) : undefined)

    return (
        <div className="relative flex w-full flex-row items-center justify-between md:block">
            {!onPrev ? (
                <Link href={href ?? '/home'} className="md:hidden">
                    <Button variant="stroke" className={navCircleBtn} data-testid="nav-back">
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
                        'absolute top-1/2 left-1/2 min-w-max -translate-x-1/2 -translate-y-1/2 transform pb-1 text-2xl font-extrabold md:relative md:top-auto md:left-auto md:hidden md:translate-x-0 md:translate-y-0 md:transform-none md:pb-0 md:text-base md:font-semibold',
                        titleClassName
                    )}
                >
                    {label}
                </div>
            )}

            {rightElement}
            {showLogoutBtn && (
                <Button
                    onClick={() => logoutUser()}
                    loading={isLoggingOut}
                    variant="stroke"
                    icon="logout"
                    className={twMerge(navCircleBtn, 'md:hidden')}
                />
            )}
        </div>
    )
}

export default NavHeader
