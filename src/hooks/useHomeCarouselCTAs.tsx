'use client'

import { type IconName } from '@/components/Global/Icons/Icon'
import { useAuth } from '@/context/authContext'
import { useEffect, useState, useCallback } from 'react'
import { useNotifications } from './useNotifications'
import { useRouter } from 'next/navigation'
import useKycStatus from './useKycStatus'
import type { StaticImageData } from 'next/image'
import { useQrCodeContext } from '@/context/QrCodeContext'
import { getUserPreferences, updateUserPreferences } from '@/utils'
import { DEVCONNECT_LOGO } from '@/assets'
import { DEVCONNECT_INTENT_EXPIRY_MS } from '@/constants'

export type CarouselCTA = {
    id: string
    title: string | React.ReactNode
    description: string | React.ReactNode
    icon: IconName
    logo?: StaticImageData
    // optional handlers for notification prompt
    onClick?: () => void | Promise<void>
    onClose?: () => void
    isPermissionDenied?: boolean
    iconContainerClassName?: string
    secondaryIcon?: StaticImageData | string
    iconSize?: number
}

export const useHomeCarouselCTAs = () => {
    const [carouselCTAs, setCarouselCTAs] = useState<CarouselCTA[]>([])
    const { user } = useAuth()
    const { showReminderBanner, requestPermission, snoozeReminderBanner, afterPermissionAttempt, isPermissionDenied } =
        useNotifications()
    const router = useRouter()
    const { isUserKycApproved, isUserBridgeKycUnderReview, isUserMantecaKycApproved } = useKycStatus()

    const { setIsQRScannerOpen } = useQrCodeContext()

    // --------------------------------------------------------------------------------------------------
    /**
     * check if there's a pending devconnect intent and clean up old ones
     *
     * @dev: note, this code needs to be deleted post devconnect, this is just to temporarily support onramp to devconnect wallet using bank accounts
     */
    const [pendingDevConnectIntent, setPendingDevConnectIntent] = useState<
        | {
              id: string
              recipientAddress: string
              chain: string
              amount: string
              onrampId?: string
              createdAt: number
              status: 'pending' | 'completed'
          }
        | undefined
    >(undefined)

    useEffect(() => {
        if (!user?.user?.userId) {
            setPendingDevConnectIntent(undefined)
            return
        }

        const prefs = getUserPreferences(user.user.userId)
        const intents = prefs?.devConnectIntents ?? []

        // clean up intents older than 7 days
        const expiryTime = Date.now() - DEVCONNECT_INTENT_EXPIRY_MS
        const recentIntents = intents.filter((intent) => intent.createdAt >= expiryTime && intent.status === 'pending')

        // update user preferences if we cleaned up any old intents
        if (recentIntents.length !== intents.length) {
            updateUserPreferences(user.user.userId, {
                devConnectIntents: recentIntents,
            })
        }

        // get the most recent pending intent (sorted by createdAt descending)
        const mostRecentIntent = recentIntents.sort((a, b) => b.createdAt - a.createdAt)[0]
        setPendingDevConnectIntent(mostRecentIntent)
    }, [user?.user?.userId])
    // --------------------------------------------------------------------------------------------------

    const generateCarouselCTAs = useCallback(() => {
        const _carouselCTAs: CarouselCTA[] = []

        // Devconnect Quests CTA
        _carouselCTAs.push({
            id: 'devconnect-quests',
            title: 'Join Devconnect Quests',
            description: (
                <p>
                    Compete in <b>3 challenges,</b> climb the leaderboard and win <b>$1500</b>
                </p>
            ),
            logo: DEVCONNECT_LOGO,
            icon: 'arrow-up-right',
            onClick: () => {
                router.push('/quests')
            },
            iconSize: 16,
        })

        // Show QR code payment prompt if user's Bridge or Manteca KYC is approved.
        if (isUserKycApproved || isUserMantecaKycApproved) {
            _carouselCTAs.push({
                id: 'qr-payment',
                title: (
                    <p>
                        Pay with <b>QR code payments</b>
                    </p>
                ),
                description: (
                    <p>
                        Get the best exchange rate, pay like a <b>local</b> and earn <b>points</b>.
                    </p>
                ),
                iconContainerClassName: 'bg-secondary-1',
                icon: 'qr-code',
                onClick: () => {
                    setIsQRScannerOpen(true)
                },
                iconSize: 16,
            })
        }

        // ------------------------------------------------------------------------------------------------
        // add devconnect payment cta if there's a pending intent
        // @dev: note, this code needs to be deleted post devconnect, this is just to temporarily support onramp to devconnect wallet using bank accounts
        if (pendingDevConnectIntent) {
            _carouselCTAs.push({
                id: 'devconnect-payment',
                title: 'Fund your DevConnect wallet',
                description: `Deposit funds to your DevConnect wallet`,
                logo: DEVCONNECT_LOGO,
                icon: 'arrow-up-right',
                onClick: () => {
                    // navigate to the semantic request flow where user can pay with peanut wallet
                    const paymentUrl = `/${pendingDevConnectIntent.recipientAddress}@${pendingDevConnectIntent.chain}`
                    router.push(paymentUrl)
                },
                onClose: () => {
                    // remove the intent when user dismisses the cta
                    if (user?.user?.userId) {
                        updateUserPreferences(user.user.userId, {
                            devConnectIntents: [],
                        })
                    }
                },
            })
        }
        // --------------------------------------------------------------------------------------------------

        // add notification prompt as first item if it should be shown
        if (showReminderBanner) {
            _carouselCTAs.push({
                id: 'notification-prompt',
                title: 'Stay in the loop!',
                description: 'Turn on notifications and get alerts for all your wallet activity.',
                icon: 'bell',
                onClick: async () => {
                    await requestPermission()
                    await afterPermissionAttempt()
                },
                onClose: () => {
                    snoozeReminderBanner()
                },
                isPermissionDenied,
            })
        }

        if (!isUserKycApproved && !isUserBridgeKycUnderReview) {
            _carouselCTAs.push({
                id: 'kyc-prompt',
                title: (
                    <span>
                        Unlock <b>QR code payments</b>
                    </span>
                ),
                description: (
                    <span>
                        Verify your account to use <b>Mercado Pago</b> and <b>PIX</b> QR codes
                    </span>
                ),
                iconContainerClassName: 'bg-secondary-1',
                icon: 'shield',
                onClick: () => {
                    router.push('/profile/identity-verification')
                },
            })
        }

        setCarouselCTAs(_carouselCTAs)
    }, [
        pendingDevConnectIntent,
        user?.user?.userId,
        showReminderBanner,
        isPermissionDenied,
        isUserKycApproved,
        isUserBridgeKycUnderReview,
        router,
        requestPermission,
        afterPermissionAttempt,
        snoozeReminderBanner,
    ])

    useEffect(() => {
        if (!user) {
            setCarouselCTAs([])
            return
        }

        generateCarouselCTAs()
    }, [user, generateCarouselCTAs])

    return { carouselCTAs, setCarouselCTAs }
}
