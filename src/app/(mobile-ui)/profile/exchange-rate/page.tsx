'use client'

import PageContainer from '@/components/0_Bruddle/PageContainer'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import { Notification } from '@/components/0_Bruddle/Notification'
import ExchangeRateWidget from '@/components/Global/ExchangeRateWidget'
import NavHeader from '@/components/Global/NavHeader'
import { useWallet } from '@/hooks/wallet/useWallet'
import { printableUsdc } from '@/utils/balance.utils'
import { toSupportedExchangeCurrency } from '@/constants/exchange-currencies.consts'
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
    // The same parser the widget uses, so the two cannot disagree about what
    // the URL says — reading it with parseAsString here meant `?from=usd` or a
    // stale `?to=PLN` showed USD->EUR in the widget while this page computed a
    // label and destination from the raw value, sending the user to
    // /withdraw/poland from a widget that never displayed PLN.
    const [{ from, to }] = useQueryStates(
        { from: parseAsString.withDefault('USD'), to: parseAsString.withDefault('EUR') },
        { shallow: true, history: 'replace', scroll: false }
    )
    // Redirects need a currency with an actual rail behind it; display does
    // not. A pair outside the six falls back to the default rather than
    // routing into a country flow the product does not serve.
    const routableFrom = toSupportedExchangeCurrency(from) ?? 'USD'
    const routableTo = toSupportedExchangeCurrency(to) ?? 'EUR'
    const formattedBalance = parseFloat(printableUsdc(balance ?? 0n))
    const destination = getExchangeRateWidgetRedirectRoute(
        routableFrom,
        routableTo,
        formattedBalance,
        unlockedRegionPaths
    )
    const goesToAddMoney = destination.startsWith('/add-money')

    const handleCtaAction = (sourceCurrency: string, destinationCurrency: string) => {
        // The widget is rendered below with `restrictToRoutable`, so these
        // arguments are already one of the six — clamped again here so the
        // route can never drift from `destination`/`goesToAddMoney` above,
        // which are computed from the same URL independently of the widget.
        const redirectRoute = getExchangeRateWidgetRedirectRoute(
            toSupportedExchangeCurrency(sourceCurrency) ?? 'USD',
            toSupportedExchangeCurrency(destinationCurrency) ?? 'EUR',
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
                        restrictToRoutable
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
