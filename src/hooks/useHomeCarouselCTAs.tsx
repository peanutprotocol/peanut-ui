'use client'

import { type IconName } from '@/components/Global/Icons/Icon'
import { useAuth } from '@/context/authContext'
import { useEffect, useState, useCallback } from 'react'
import { useNotifications } from './useNotifications'
import { useRouter } from 'next/navigation'
import useKycStatus from './useKycStatus'
import type { StaticImageData } from 'next/image'
import { useModalsContext } from '@/context/ModalsContext'
import { DeviceType, useDeviceType } from './useGetDeviceType'
import { usePWAStatus } from './usePWAStatus'
import { useGeoLocation } from './useGeoLocation'
import { STAR_STRAIGHT_ICON } from '@/assets'

export type CarouselCTA = {
    id: string
    title: string | React.ReactNode
    description: string | React.ReactNode
    icon: IconName
    logo?: StaticImageData
    logoSize?: number
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
    const { requestPermission, afterPermissionAttempt, isPermissionDenied, isPermissionGranted } = useNotifications()
    const router = useRouter()
    const { isUserKycApproved, isUserBridgeKycUnderReview, isUserMantecaKycApproved } = useKycStatus()
    const { deviceType } = useDeviceType()
    const isPwa = usePWAStatus()
    const { setIsIosPwaInstallModalOpen } = useModalsContext()

    const { setIsQRScannerOpen } = useModalsContext()
    const { countryCode: userCountryCode } = useGeoLocation()

    const generateCarouselCTAs = useCallback(() => {
        const _carouselCTAs: CarouselCTA[] = []

        // DRY: Check KYC approval status once
        const hasKycApproval = isUserKycApproved || isUserMantecaKycApproved
        const isLatamUser = userCountryCode === 'AR' || userCountryCode === 'BR'

        // Generic invite CTA for non-LATAM users
        if (!isLatamUser) {
            _carouselCTAs.push({
                id: 'invite-friends',
                title: 'Invite friends. Get cashback',
                description: "Your friends' activity earns you badges, perks & rewards.",
                icon: 'invite-heart',
                logo: STAR_STRAIGHT_ICON,
                logoSize: 30,
                onClick: () => {
                    router.push('/points')
                },
            })
        }
        // show notification cta only in pwa when notifications are not granted
        // clicking it triggers native prompt (or shows reinstall modal if denied)
        if (!isPermissionGranted && isPwa) {
            _carouselCTAs.push({
                id: 'notification-prompt',
                title: 'Stay in the loop!',
                description: 'Turn on notifications and get alerts for all your wallet activity.',
                icon: 'bell',
                onClick: async () => {
                    // trigger native notification permission prompt
                    await requestPermission()
                    await afterPermissionAttempt()
                },
                isPermissionDenied, // if true, CarouselCTA shows reinstall modal instead
            })
        }

        if (deviceType === DeviceType.IOS && !isPwa) {
            _carouselCTAs.push({
                id: 'ios-pwa-install',
                title: 'Add Peanut to your home screen',
                description: 'Follow a quick guide to add the app to your home screen, no download needed.',
                iconContainerClassName: 'bg-secondary-1',
                icon: 'mobile-install',
                onClick: () => {
                    setIsIosPwaInstallModalOpen(true)
                },
                iconSize: 16,
            })
        }

        // Show QR code payment prompt if user's Bridge or Manteca KYC is approved.
        if (hasKycApproval) {
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
        // LATAM Cashback CTA - show to all users in Argentina or Brazil
        // Encourage them to invite friends to earn more cashback (and complete KYC if needed)
        if (isLatamUser) {
            _carouselCTAs.push({
                id: 'latam-cashback-invite',
                title: (
                    <p>
                        Earn <b>20% cashback</b> on QR payments
                    </p>
                ),
                description: (
                    <p>
                        Invite friends to <b>unlock more rewards</b>. The more they use, the more you earn!
                    </p>
                ),
                iconContainerClassName: 'bg-secondary-1',
                icon: 'gift',
                onClick: () => {
                    router.push('/points')
                },
                iconSize: 16,
            })
        }

        if (!hasKycApproval && !isUserBridgeKycUnderReview) {
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
        user?.user?.userId,
        isPermissionGranted,
        isPermissionDenied,
        isUserKycApproved,
        isUserBridgeKycUnderReview,
        isUserMantecaKycApproved,
        router,
        requestPermission,
        afterPermissionAttempt,
        setIsQRScannerOpen,
        deviceType,
        isPwa,
        userCountryCode,
    ])

    useEffect(() => {
        if (!user) {
            setCarouselCTAs([])
            return
        }

        generateCarouselCTAs()
    }, [user, generateCarouselCTAs, isPermissionGranted])

    return { carouselCTAs, setCarouselCTAs }
}
