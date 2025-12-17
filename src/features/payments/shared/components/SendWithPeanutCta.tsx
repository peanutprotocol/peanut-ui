'use client'

import { PEANUT_LOGO_BLACK, PEANUTMAN_LOGO } from '@/assets'
import { Button, type ButtonProps } from '@/components/0_Bruddle/Button'
import { useAuth } from '@/context/authContext'
import { saveRedirectUrl } from '@/utils/general.utils'
import Image from 'next/image'
import { useRouter } from 'next/navigation'

interface SendWithPeanutCtaProps extends ButtonProps {
    title?: string
    // when true, will redirect to login if user is not logged in
    requiresAuth?: boolean
}

/**
 * Button to continue with Peanut or login to continue with peanut icon
 * @param title - The title of the button (optional)
 * @param requiresAuth - Whether the button requires authentication
 * @param onClick - The onClick handler
 * @param props - The props for the button
 * @returns The button component
 */

export default function SendWithPeanutCta({ title, requiresAuth = true, onClick, ...props }: SendWithPeanutCtaProps) {
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

        // otherwise call the provided onClick handler
        onClick?.(e)
    }

    return (
        <Button
            variant="purple"
            shadowSize="4"
            className="w-full"
            icon="arrow-up-right"
            iconSize={16}
            onClick={handleClick}
            {...props}
        >
            {!isLoggedIn ? (
                <div className="flex items-center gap-1">
                    <div>Continue with </div>
                    <div className="flex items-center gap-1">
                        <Image src={PEANUTMAN_LOGO} alt="Peanut Logo" className="size-5" />
                        <Image src={PEANUT_LOGO_BLACK} alt="Peanut Logo" />
                    </div>
                </div>
            ) : (
                <div className="flex items-center gap-1">
                    <div>{title || 'Send with '} </div>
                    <div className="flex items-center gap-1">
                        <Image src={PEANUTMAN_LOGO} alt="Peanut Logo" className="size-5" />
                        <Image src={PEANUT_LOGO_BLACK} alt="Peanut Logo" />
                    </div>
                </div>
            )}
        </Button>
    )
}
