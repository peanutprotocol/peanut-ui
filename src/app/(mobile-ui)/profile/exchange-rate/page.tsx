'use client'

import PageContainer from '@/components/0_Bruddle/PageContainer'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import { Notification } from '@/components/0_Bruddle/Notification'
import ExchangeRateWidget from '@/components/Global/ExchangeRateWidget'
import NavHeader from '@/components/Global/NavHeader'
import { useWallet } from '@/hooks/wallet/useWallet'
import { printableUsdc } from '@/utils/balance.utils'
import { getExchangeRateWidgetRedirectRoute } from '@/utils/exchangeRateWidget.utils'
import { withReturnTo } from '@/utils/return-to.utils'
import { useCapabilities } from '@/hooks/useCapabilities'
import { deriveRegionAccess } from '@/utils/regions.utils'
import { useTranslations } from 'next-intl'
import { parseAsString, useQueryStates } from 'nuqs'
import { useRouter } from 'next/navigation'
import { useSafeBack } from '@/hooks/useSafeBack'
import { useMemo } from 'react'

export default function ExchangeRatePage() {
    const t = useTranslations('exchangeRate')
    const tCommon = useTranslations('common')
    const router = useRouter()
    const onBack = useSafeBack('/profile', { replace: true })
    const { balance } = useWallet()
    const { rails } = useCapabilities()
    const unlockedRegionPaths = useMemo(
        () => deriveRegionAccess(rails).unlockedRegions.map((region) => region.path),
        [rails]
    )

    // The widget keeps its pair in the URL (nuqs, same keys and defaults), so
    // the destination is derivable BEFORE the tap — the label has to be,
    // because a zero balance or a local→USD pair routes to /add-money and a
    // fixed "Withdraw now" would name the opposite flow.
    const [{ from, to }] = useQueryStates(
        { from: parseAsString.withDefault('USD'), to: parseAsString.withDefault('EUR') },
        { shallow: true, history: 'replace', scroll: false }
    )
    const formattedBalance = parseFloat(printableUsdc(balance ?? 0n))
    const destination = getExchangeRateWidgetRedirectRoute(from, to, formattedBalance, unlockedRegionPaths)
    const goesToAddMoney = destination.startsWith('/add-money')

    const handleCtaAction = (sourceCurrency: string, destinationCurrency: string) => {
        const redirectRoute = getExchangeRateWidgetRedirectRoute(
            sourceCurrency,
            destinationCurrency,
            formattedBalance,
            unlockedRegionPaths
        )

        // The CTA drops the user into the add-money / withdraw roots, whose back
        // buttons reset to /home. Tell them where the user actually came from so
        // back returns to this widget — query string included, so the currency
        // pair and amount they were looking at are still there.
        const returnTo = `${window.location.pathname}${window.location.search}`
        router.push(withReturnTo(redirectRoute, returnTo))
    }

    return (
        <PageContainer>
            <PageStack gap="6">
                <NavHeader title={t('title')} onPrev={onBack} />
                {/* The pair the widget shows is a conversion, not a wallet:
                    people read "EUR" here as "my balance is in euros". */}
                <Notification priority="info">{t('balanceNote')}</Notification>
                <PageStack.Center>
                    <ExchangeRateWidget
                        ctaIcon="arrow-down"
                        ctaLabel={goesToAddMoney ? t('addMoneyCta') : t('tryIt')}
                        ctaAction={handleCtaAction}
                        labels={{
                            youSend: t('widget.youSend'),
                            recipientGets: t('widget.recipientGets'),
                            swapCurrencies: t('widget.swapCurrencies'),
                            rateUnavailable: t('widget.rateUnavailable'),
                            bankFee: t('widget.bankFee'),
                            peanutFee: tCommon('peanutFee'),
                            free: t('widget.free'),
                            arrivesHours: t('widget.arrivesHours'),
                            arrivesMinutes: t('widget.arrivesMinutes'),
                        }}
                    />
                </PageStack.Center>
            </PageStack>
        </PageContainer>
    )
}
