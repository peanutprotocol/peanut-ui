'use client'

/**
 * primary cta button for peanut wallet payments
 *
 * shows different states:
 * - not logged in: "continue with peanut" + redirects to signup, then redirects to the current page
 * - logged in: "send with peanut" + executes payment
 */

import { PEANUT_LOGO_BLACK, PEANUTMAN_LOGO } from '@/assets'
import { Button, type ButtonProps } from '@/components/0_Bruddle/Button'
import type { IconName } from '@/components/Global/Icons/Icon'
import { useAuth } from '@/context/authContext'
import { saveRedirectUrl, saveToLocalStorage } from '@/utils/general.utils'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useMemo } from 'react'

interface SendWithPeanutCtaProps extends ButtonProps {
    title?: string
    // when true, will redirect to login if user is not logged in
    requiresAuth?: boolean
    insufficientBalance?: boolean
}

/**
 * Button to continue with Peanut or login to continue with peanut icon
 * @param title - The title of the button (optional)
 * @param requiresAuth - Whether the button requires authentication
 * @param onClick - The onClick handler
 * @param props - The props for the button
 * @returns The button component
 */

export default function SendWithPeanutCta({
    title,
    requiresAuth = true,
    onClick,
    insufficientBalance = false,
    ...props
}: SendWithPeanutCtaProps) {
    const router = useRouter()
    const { user, isFetchingUser } = useAuth()

    const isLoggedIn = !!user?.user?.userId

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
        // if auth is required and user is not logged in, redirect to login
        if (requiresAuth && !user?.user?.userId && !isFetchingUser) {
            saveRedirectUrl()
            router.push('/setup')
            return
        }

        if (isLoggedIn && insufficientBalance) {
            // save current url so back button works properly
            saveRedirectUrl()
            saveToLocalStorage('fromRequestFulfillment', 'true')
            router.push('/add-money')
            return
        }

        // otherwise call the provided onClick handler
        onClick?.(e)
    }

    const icon = useMemo((): IconName | undefined => {
        if (!isLoggedIn) {
            return undefined
        }
        if (insufficientBalance) {
            return 'arrow-down'
        }
        return 'arrow-up-right'
    }, [isLoggedIn, insufficientBalance])

    const peanutLogo = useMemo((): React.ReactNode => {
        return (
            <div className="flex items-center gap-1">
                <Image src={PEANUTMAN_LOGO} alt="Peanut Logo" className="size-5" />
                <Image src={PEANUT_LOGO_BLACK} alt="Peanut Logo" />
            </div>
        )
    }, [])

    return (
        <Button
            variant="purple"
            shadowSize="4"
            className="w-full"
            icon={icon}
            iconSize={16}
            onClick={handleClick}
            {...props}
        >
            {!isLoggedIn ? (
                <div className="flex items-center gap-1">
                    <div>Join </div>
                    {peanutLogo}
                </div>
            ) : insufficientBalance ? (
                <div className="flex items-center gap-1">
                    <div>Add funds to </div>
                    {peanutLogo}
                </div>
            ) : (
                <div className="flex items-center gap-1">
                    <div>{title || 'Send with '} </div>
                    {peanutLogo}
                </div>
            )}
        </Button>
    )
}
