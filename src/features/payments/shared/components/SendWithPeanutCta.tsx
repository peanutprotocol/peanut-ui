'use client'

/**
 * primary cta button for peanut wallet payments
 *
 * shows different states:
 * - not logged in: "continue with peanut" + redirects to signup, then redirects to the current page
 * - logged in: "send with peanut" + executes payment
 */

import PEANUT_LOGO_BLACK from '@/assets/logos/peanut-logo-dark.svg'
import { PEANUTMAN } from '@/assets/mascot'
import { Button, type ButtonProps } from '@/components/0_Bruddle/Button'
import type { IconName } from '@/components/Global/Icons/Icon'
import { useAuth } from '@/context/authContext'
import { EInviteType } from '@/services/services.types'
import { saveRedirectUrl, saveToLocalStorage, toInviteCode, inviteFlowUrl } from '@/utils/general.utils'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { useGuestStoreHandoff } from '@/hooks/useGuestStoreHandoff'
import { stashInvite } from '@/utils/invite-stash'

interface SendWithPeanutCtaProps extends ButtonProps {
    title?: string
    // when true, will redirect to login if user is not logged in
    requiresAuth?: boolean
    insufficientBalance?: boolean
    // username of the person who created the request/link — used to generate an invite code for non-logged-in users
    inviterUsername?: string
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
    inviterUsername,
    ...props
}: SendWithPeanutCtaProps) {
    const router = useRouter()
    const t = useTranslations('payment')
    const { user, isFetchingUser } = useAuth()

    const isLoggedIn = !!user?.user?.userId
    // assume logged in while fetching to prevent "Join Peanut" flash
    const showAsLoggedIn = isFetchingUser || isLoggedIn
    const { interceptGuestCta, storeHandoffModal } = useGuestStoreHandoff({
        trackImpressionWhenGuest: requiresAuth && !isFetchingUser && !isLoggedIn,
    })

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
        // don't act while auth is still resolving
        if (isFetchingUser) return

        // if auth is required and user is not logged in, redirect to signup
        if (requiresAuth && !isLoggedIn) {
            // migration window: web signups are closed — hand the guest to the
            // app stores instead (QR modal on desktop, store link on mobile).
            // the inviter rides the deferred hand-off, mirroring the web path
            // below that routes to /invite?code=<inviter>
            if (interceptGuestCta({ invite: inviterUsername ? toInviteCode(inviterUsername) : undefined })) return
            const redirectUri = encodeURIComponent(
                window.location.pathname + window.location.search + window.location.hash
            )
            if (inviterUsername) {
                const inviteCode = toInviteCode(inviterUsername)
                stashInvite(inviteCode, EInviteType.PAYMENT_LINK)
                router.push(inviteFlowUrl(inviteCode, redirectUri))
            } else {
                saveRedirectUrl()
                router.push('/setup')
            }
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
        if (!showAsLoggedIn) {
            return undefined
        }
        if (insufficientBalance) {
            return 'arrow-down'
        }
        return 'arrow-up-right'
    }, [showAsLoggedIn, insufficientBalance])

    const peanutLogo = useMemo((): React.ReactNode => {
        return (
            <div className="flex items-center gap-1">
                <Image src={PEANUTMAN} alt="Peanut Logo" className="size-5" />
                <Image src={PEANUT_LOGO_BLACK} alt="Peanut Logo" />
            </div>
        )
    }, [])

    return (
        <>
            {storeHandoffModal}
            <Button
                variant="purple"
                shadowSize="4"
                className="w-full"
                icon={icon}
                iconSize={16}
                onClick={handleClick}
                {...props}
            >
                {!showAsLoggedIn ? (
                    <div className="flex items-center gap-1">
                        <div>{t('cta.join')} </div>
                        {peanutLogo}
                    </div>
                ) : insufficientBalance ? (
                    <div className="flex items-center gap-1">
                        <div>{t('cta.addFundsTo')} </div>
                        {peanutLogo}
                    </div>
                ) : (
                    <div className="flex items-center gap-1">
                        <div>{title || t('cta.sendWith')} </div>
                        {peanutLogo}
                    </div>
                )}
            </Button>
        </>
    )
}
