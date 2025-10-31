'use client'

import { type IconName } from '@/components/Global/Icons/Icon'
import { useAuth } from '@/context/authContext'
import { useEffect, useState } from 'react'
import { useNotifications } from './useNotifications'
import { useRouter } from 'next/navigation'
import useKycStatus from './useKycStatus'
import { MERCADO_PAGO } from '@/assets'
import type { StaticImageData } from 'next/image'

export type Banner = {
    id: string
    title: string | React.ReactNode
    description: string | React.ReactNode
    icon: IconName
    logo?: StaticImageData
    // optional handlers for notification banner
    onClick?: () => void | Promise<void>
    onClose?: () => void
    isPermissionDenied?: boolean
    iconContainerClassName?: string
}

export const useBanners = () => {
    const [banners, setBanners] = useState<Banner[]>([])
    const { user } = useAuth()
    const { showReminderBanner, requestPermission, snoozeReminderBanner, afterPermissionAttempt, isPermissionDenied } =
        useNotifications()
    const router = useRouter()
    const { isUserKycApproved, isUserBridgeKycUnderReview } = useKycStatus()

    const generateBanners = () => {
        const _banners: Banner[] = []

        // add notification banner as first item if it should be shown
        if (showReminderBanner) {
            _banners.push({
                id: 'notification-banner',
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
            _banners.push({
                id: 'kyc-banner',
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

        setBanners(_banners)
    }

    useEffect(() => {
        if (!user) {
            setBanners([])
            return
        }

        generateBanners()
    }, [user, showReminderBanner, isPermissionDenied])

    return { banners, setBanners }
}
