'use client'

import { type IconName } from '@/components/Global/Icons/Icon'
import { useAuth } from '@/context/authContext'
import { useEffect, useState, useCallback } from 'react'
import { useNotifications } from './useNotifications'
import { useRouter } from 'next/navigation'
import useKycStatus from './useKycStatus'
import type { StaticImageData } from 'next/image'
import { PIX } from '@/assets'

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
}

export const useHomeCarouselCTAs = () => {
    const [carouselCTAs, setCarouselCTAs] = useState<CarouselCTA[]>([])
    const { user } = useAuth()
    const { showReminderBanner, requestPermission, snoozeReminderBanner, afterPermissionAttempt, isPermissionDenied } =
        useNotifications()
    const router = useRouter()
    const { isUserKycApproved, isUserBridgeKycUnderReview } = useKycStatus()

    const generateCarouselCTAs = useCallback(() => {
        const _carouselCTAs: CarouselCTA[] = []

        _carouselCTAs.push({
            id: 'merchant-map-pix',
            title: 'Up to 10% cashback for Tier 2 users with PIX Payments',
            description: 'Click to explore participating merchants. Pay with PIX QR, save instantly, earn points.',
            iconContainerClassName: 'bg-secondary-1',
            icon: 'shield',
            onClick: () => {
                window.open(
                    'https://peanutprotocol.notion.site/Peanut-Foodie-Guide-29a83811757980e79896f2a610d6591a',
                    '_blank'
                )
            },
            logo: PIX,
            secondaryIcon: 'https://flagcdn.com/w320/br.png',
        })

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
