'use client'

import PageContainer from '@/components/0_Bruddle/PageContainer'
import ExchangeRateWidget from '@/components/Global/ExchangeRateWidget'
import NavHeader from '@/components/Global/NavHeader'
import { useWallet } from '@/hooks/wallet/useWallet'
import { printableUsdc } from '@/utils/balance.utils'
import { getExchangeRateWidgetRedirectRoute } from '@/utils/exchangeRateWidget.utils'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function ExchangeRatePage() {
    const router = useRouter()
    const { fetchBalance, balance } = useWallet()

    const handleCtaAction = (sourceCurrency: string, destinationCurrency: string) => {
        const formattedBalance = parseFloat(printableUsdc(balance ?? 0n))

        const redirectRoute = getExchangeRateWidgetRedirectRoute(sourceCurrency, destinationCurrency, formattedBalance)
        router.push(redirectRoute)
    }

    useEffect(() => {
        // Fetch latest balance
        fetchBalance()
    }, [])

    return (
        <PageContainer className="flex flex-col">
            <NavHeader title="Exchange rate & fees" onPrev={() => router.replace('/profile')} />
            <div className="m-auto">
                <ExchangeRateWidget ctaIcon="arrow-down" ctaLabel="Try it!" ctaAction={handleCtaAction} />
            </div>
        </PageContainer>
    )
}
