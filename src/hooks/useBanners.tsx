import { IconName } from '@/components/Global/Icons/Icon'
import { useAuth } from '@/context/authContext'
import { useEffect, useState } from 'react'

export type Banner = {
    id: string
    title: string
    description: string
    icon: IconName
}

export const useBanners = () => {
    const [banners, setBanners] = useState<Banner[]>([])
    const { user } = useAuth()

    const generateBanners = () => {
        const _banners: Banner[] = []
        if (user?.user.bridgeKycStatus !== 'approved') {
            // TODO: Add manteca KYC check after manteca is implemented
            _banners.push({
                id: 'kyc-banner',
                title: 'Unlock bank & local payments',
                description: 'Complete verification to add, withdraw or pay using Mercado Pago.',
                icon: 'shield',
            })
        }

        // TODO: Add notifications banner after notifications are implemented

        setBanners(_banners)
    }

    useEffect(() => {
        if (user) {
            generateBanners()
        }
    }, [user])

    return { banners, setBanners }
}
