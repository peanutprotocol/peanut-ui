'use client'
import { Button } from '@/components/0_Bruddle/Button'
import Link from 'next/link'
import { twMerge } from 'tailwind-merge'
import { Icon, type IconName } from '../Icons/Icon'
import { useAuth } from '@/context/authContext'

interface NavHeaderProps {
    onPrev?: () => void
    disableBackBtn?: boolean
    title?: string
    href?: string
    hideLabel?: boolean
    icon?: IconName
    showLogoutBtn?: boolean
    titleClassName?: string
}

const NavHeader = ({
    title,
    icon = 'chevron-up',
    href,
    hideLabel = false,
    onPrev,
    disableBackBtn,
    showLogoutBtn = false,
    titleClassName,
}: NavHeaderProps) => {
    const { logoutUser, isLoggingOut } = useAuth()

    return (
        <div className="relative flex w-full flex-row items-center justify-between md:block">
            {!onPrev ? (
                <Link href={href ?? '/home'} className="md:hidden">
                    <Button variant="stroke" className="h-7 w-7 p-0" data-testid="nav-back">
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
                    className="h-7 w-7 p-0"
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
                        'absolute left-1/2 top-1/2 min-w-max -translate-x-1/2 -translate-y-1/2 transform pb-1 text-2xl font-extrabold md:relative md:left-auto md:top-auto md:hidden md:translate-x-0 md:translate-y-0 md:transform-none md:pb-0 md:text-base md:font-semibold',
                        titleClassName
                    )}
                >
                    {title}
                </div>
            )}

            {showLogoutBtn && (
                <Button
                    onClick={() => logoutUser()}
                    loading={isLoggingOut}
                    variant="stroke"
                    icon="logout"
                    className={twMerge('h-7 w-7 p-0 md:hidden')}
                />
            )}
        </div>
    )
}

export default NavHeader
