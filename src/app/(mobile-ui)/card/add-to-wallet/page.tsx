'use client'
import { type FC, useEffect } from 'react'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import PageContainer from '@/components/0_Bruddle/PageContainer'
import AddToWalletCarousel from '@/components/Card/AddToWalletCarousel'
import { useWalletPlatform } from '@/hooks/useWalletPlatform'
import { useSafeBack } from '@/hooks/useSafeBack'

const AddToWalletPage: FC = () => {
    const platform = useWalletPlatform()
    const onBack = useSafeBack('/card')
    useEffect(() => {
        posthog.capture(ANALYTICS_EVENTS.CARD_ADD_TO_WALLET_VIEWED, { platform: platform ?? 'unknown' })
    }, [platform])
    return (
        <PageContainer>
            <AddToWalletCarousel onDone={onBack} onPrev={onBack} />
        </PageContainer>
    )
}

export default AddToWalletPage
