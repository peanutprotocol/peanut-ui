'use client'
import { type FC, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import PageContainer from '@/components/0_Bruddle/PageContainer'
import AddToWalletCarousel from '@/components/Card/AddToWalletCarousel'
import { useWalletPlatform } from '@/hooks/useWalletPlatform'

const AddToWalletPage: FC = () => {
    const router = useRouter()
    const platform = useWalletPlatform()
    useEffect(() => {
        posthog.capture(ANALYTICS_EVENTS.CARD_ADD_TO_WALLET_VIEWED, { platform: platform ?? 'unknown' })
    }, [platform])
    return (
        <PageContainer>
            <AddToWalletCarousel onDone={() => router.push('/card')} onPrev={() => router.push('/card')} />
        </PageContainer>
    )
}

export default AddToWalletPage
