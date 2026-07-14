'use client'

import PageContainer from '@/components/0_Bruddle/PageContainer'
import ExchangeRateWidget from '@/components/Global/ExchangeRateWidget'
import NavHeader from '@/components/Global/NavHeader'
import { useWallet } from '@/hooks/wallet/useWallet'
import { printableUsdc } from '@/utils/balance.utils'
import { getExchangeRateWidgetRedirectRoute } from '@/utils/exchangeRateWidget.utils'
import { useCapabilities } from '@/hooks/useCapabilities'
import { deriveRegionAccess } from '@/utils/regions.utils'
import { useRouter } from 'next/navigation'
import { useSafeBack } from '@/hooks/useSafeBack'
import { useMemo } from 'react'

export default function ExchangeRatePage() {
    const router = useRouter()
    const onBack = useSafeBack('/profile', { replace: true })
    const { balance } = useWallet()
    const { rails } = useCapabilities()
    const unlockedRegionPaths = useMemo(
        () => deriveRegionAccess(rails).unlockedRegions.map((region) => region.path),
        [rails]
    )

    const handleCtaAction = (sourceCurrency: string, destinationCurrency: string) => {
        const formattedBalance = parseFloat(printableUsdc(balance ?? 0n))

        const redirectRoute = getExchangeRateWidgetRedirectRoute(
            sourceCurrency,
            destinationCurrency,
            formattedBalance,
            unlockedRegionPaths
        )
        router.push(redirectRoute)
    }

    return (
        <PageContainer className="flex flex-col">
            <NavHeader title="Exchange rate & fees" onPrev={onBack} />
            <div className="m-auto">
                <ExchangeRateWidget ctaIcon="arrow-down" ctaLabel="Try it!" ctaAction={handleCtaAction} />
            </div>
        </PageContainer>
    )
}
