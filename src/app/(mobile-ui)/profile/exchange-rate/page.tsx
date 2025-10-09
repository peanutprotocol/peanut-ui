'use client'

import PageContainer from '@/components/0_Bruddle/PageContainer'
import ExchangeRateWidget from '@/components/Global/ExchangeRateWidget'
import NavHeader from '@/components/Global/NavHeader'
import countryCurrencyMappings from '@/constants/countryCurrencyMapping'
import { useWallet } from '@/hooks/wallet/useWallet'
import { printableUsdc } from '@/utils'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function ExchangeRatePage() {
    const router = useRouter()
    const { fetchBalance, balance } = useWallet()

    const handleCtaAction = (sourceCurrency: string, destinationCurrency: string) => {
        let route = '/add-money'
        let countryPath: string | undefined = ''

        // Case 1: source currency is not usd and destination currency is usd -> redirect to add-money/sourceCurrencyCountry page
        if (sourceCurrency !== 'USD' && destinationCurrency === 'USD') {
            countryPath = countryCurrencyMappings.find((currency) => currency.currencyCode === sourceCurrency)?.path
            route = '/add-money'
        }

        // Case 2: source currency is usd and destination currency is not usd -> redirect to withdraw/destinationCurrencyCountry page
        if (sourceCurrency === 'USD' && destinationCurrency !== 'USD') {
            const formattedBalance = printableUsdc(balance ?? 0n)

            // if there is no balance, redirect to add-money
            if (parseFloat(formattedBalance) <= 0) {
                countryPath = countryCurrencyMappings.find((currency) => currency.currencyCode === sourceCurrency)?.path
                route = '/add-money'
            } else {
                countryPath = countryCurrencyMappings.find(
                    (currency) => currency.currencyCode === destinationCurrency
                )?.path
                route = '/withdraw'
            }
        }

        // Case 3: source currency is not usd and destination currency is not usd -> redirect to add-money/sourceCurrencyCountry page
        if (sourceCurrency !== 'USD' && destinationCurrency !== 'USD') {
            countryPath = countryCurrencyMappings.find((currency) => currency.currencyCode === sourceCurrency)?.path
            route = '/add-money'
        }

        if (!countryPath) {
            const redirectRoute = `${route}?currencyCode=EUR`
            router.push(redirectRoute)
        } else {
            const redirectRoute = `${route}/${countryPath}`
            router.push(redirectRoute)
        }
    }

    useEffect(() => {
        // Fetch latest balance
        fetchBalance()
    }, [])

    return (
        <PageContainer className="flex flex-col">
            <NavHeader title="Exchange rate & fees" onPrev={() => router.replace('/profile')} />
            <div className="m-auto">
                <ExchangeRateWidget ctaIcon="arrow-down" ctaLabel="Add money to try it" ctaAction={handleCtaAction} />
            </div>
        </PageContainer>
    )
}
