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
    title: string
    description: string
    icon: IconName
    logo?: StaticImageData
    // optional handlers for notification banner
    onClick?: () => void | Promise<void>
    onClose?: () => void
    isPermissionDenied?: boolean
}

export const useBanners = () => {
    const [banners, setBanners] = useState<Banner[]>([])
    const { user } = useAuth()
    const { showReminderBanner, requestPermission, snoozeReminderBanner, afterPermissionAttempt, isPermissionDenied } =
        useNotifications()
    const router = useRouter()
    const { isUserKycApproved } = useKycStatus()

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

        if (!isUserKycApproved) {
            // TODO: Add manteca KYC check after manteca is implemented
            _banners.push({
                id: 'kyc-banner',
                title: 'Unlock payments in Argentina',
                description: 'Complete verification to pay with Mercado Pago QR codes',
                icon: 'shield',
                onClick: () => {
                    router.push('/profile/identity-verification')
                },
                logo: MERCADO_PAGO,
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
