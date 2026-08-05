'use client'

import PageContainer from '@/components/0_Bruddle/PageContainer'
import ExchangeRateWidget from '@/components/Global/ExchangeRateWidget'
import NavHeader from '@/components/Global/NavHeader'
import { useWallet } from '@/hooks/wallet/useWallet'
import { printableUsdc } from '@/utils/balance.utils'
import { getExchangeRateWidgetRedirectRoute } from '@/utils/exchangeRateWidget.utils'
import { useCapabilities } from '@/hooks/useCapabilities'
import { deriveRegionAccess } from '@/utils/regions.utils'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useSafeBack } from '@/hooks/useSafeBack'
import { useMemo } from 'react'

export default function ExchangeRatePage() {
    const t = useTranslations('exchangeRate')
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
            <NavHeader title={t('title')} onPrev={onBack} />
            <div className="m-auto">
                <ExchangeRateWidget
                    ctaIcon="arrow-down"
                    ctaLabel={t('tryIt')}
                    ctaAction={handleCtaAction}
                    labels={{
                        youSend: t('widget.youSend'),
                        recipientGets: t('widget.recipientGets'),
                        swapCurrencies: t('widget.swapCurrencies'),
                        rateUnavailable: t('widget.rateUnavailable'),
                        bankFee: t('widget.bankFee'),
                        peanutFee: t('widget.peanutFee'),
                        free: t('widget.free'),
                        arrivesHours: t('widget.arrivesHours'),
                        arrivesMinutes: t('widget.arrivesMinutes'),
                    }}
                />
            </div>
        </PageContainer>
    )
}
