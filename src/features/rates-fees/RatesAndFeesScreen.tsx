'use client'

import { useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { parseAsString, useQueryStates } from 'nuqs'
import { Card } from '@/components/0_Bruddle/Card'
import { CONCEPT_ICONS } from '@/components/0_Bruddle/conceptIcons'
import { DataRow } from '@/components/0_Bruddle/DataRow'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { ListGroup } from '@/components/0_Bruddle/ListGroup'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import PageContainer from '@/components/0_Bruddle/PageContainer'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import { Tabs } from '@/components/0_Bruddle/Tabs'
import NavHeader from '@/components/Global/NavHeader'
import {
    resolveExchangeCurrencyPair,
    toSupportedExchangeCurrency,
    type SupportedExchangeCurrency,
} from '@/constants/exchange-currencies.consts'
import { useAuth } from '@/context/authContext'
import { useCapabilities } from '@/hooks/useCapabilities'
import { useSafeBack } from '@/hooks/useSafeBack'
import { useWallet } from '@/hooks/wallet/useWallet'
import { printableUsdc } from '@/utils/balance.utils'
import { formatAmountNumber } from '@/utils/currency'
import { getExchangeRateWidgetRedirectRoute } from '@/utils/exchangeRateWidget.utils'
import { useNativePlatform } from '@/utils/native-platform'
import { deriveRegionAccess } from '@/utils/regions.utils'
import { withReturnTo } from '@/utils/return-to.utils'
import { AllCurrenciesView } from './AllCurrenciesView'
import { FeesScheduleView } from './FeesScheduleView'
import { MarketBenchmarksList } from './MarketBenchmarksList'
import { RateConverterCard } from './RateConverterCard'
import {
    BENCHMARK_CURRENCIES,
    DEFAULT_INPUT_AMOUNT,
    defaultCurrencyForCountry,
    RATE_DECIMALS,
    type RatesDirection,
} from './rates-fees.utils'
import { useAllDisplayRates, useFeeSchedule, useReferenceBenchmarks } from './useRatesAndFees'

type RatesTab = 'rates' | 'fees'
type RatesSubView = 'main' | 'compare' | 'all'

export function RatesAndFeesScreen() {
    const t = useTranslations('exchangeRate')
    const locale = useLocale()
    const router = useRouter()
    const native = useNativePlatform()
    const onBackToSettings = useSafeBack('/profile', { replace: true })

    const { user } = useAuth()
    const userCountryCode = user?.residence?.verified?.country || user?.residence?.declared?.country || null
    const defaultCur = defaultCurrencyForCountry(userCountryCode)

    const { spendableBalance, isFetchingSpendableBalance } = useWallet()
    const balancePending = isFetchingSpendableBalance || spendableBalance === undefined
    const { rails } = useCapabilities()
    const unlockedRegionPaths = useMemo(
        () => deriveRegionAccess(rails).unlockedRegions.map((region) => region.path),
        [rails]
    )

    // URL state holds user-facing tab, currency, direction, and sub-view (design.md § state).
    // Preserves legacy `?from=&to=` deep links cleanly.
    const [query, setQuery] = useQueryStates(
        {
            tab: parseAsString.withDefault('rates'),
            cur: parseAsString.withDefault(''),
            dir: parseAsString.withDefault(''),
            view: parseAsString.withDefault('main'),
            from: parseAsString.withDefault(''),
            to: parseAsString.withDefault(''),
        },
        { shallow: true, history: 'replace', scroll: false }
    )

    const legacyPair = useMemo(() => {
        if (!query.from && !query.to) return null
        return resolveExchangeCurrencyPair(query.from, query.to, toSupportedExchangeCurrency)
    }, [query.from, query.to])

    const activeTab: RatesTab = query.tab === 'fees' ? 'fees' : 'rates'
    const subView: RatesSubView = query.view === 'compare' || query.view === 'all' ? query.view : 'main'

    const activeCurrency: SupportedExchangeCurrency = useMemo(() => {
        const explicit = toSupportedExchangeCurrency(query.cur)
        if (explicit) return explicit
        if (legacyPair) {
            const [fromCur, toCur] = legacyPair
            if (fromCur !== 'USD') return fromCur as SupportedExchangeCurrency
            if (toCur !== 'USD') return toCur as SupportedExchangeCurrency
            return 'USD'
        }
        return defaultCur
    }, [query.cur, legacyPair, defaultCur])

    const activeDirection: RatesDirection = useMemo(() => {
        if (query.dir === 'add' || query.dir === 'withdraw') return query.dir
        if (legacyPair) {
            return legacyPair[0] === 'USD' ? 'withdraw' : 'add'
        }
        return 'add'
    }, [query.dir, legacyPair])

    const [amountOverrides, setAmountOverrides] = useState<Record<string, string>>({})
    const amountKey = `${activeCurrency}:${activeDirection}`
    const amountInput =
        amountOverrides[amountKey] ?? (activeDirection === 'add' ? DEFAULT_INPUT_AMOUNT[activeCurrency] : '100')

    const { data: ratesSnapshot, isLoading: ratesLoading } = useAllDisplayRates()
    const { schedule: feeSchedule } = useFeeSchedule()
    const hasBenchmarks = BENCHMARK_CURRENCIES.has(activeCurrency)
    const { data: benchmarksData, isLoading: benchmarksLoading } = useReferenceBenchmarks(
        activeCurrency,
        subView === 'compare' && hasBenchmarks
    )

    const rateEntry = ratesSnapshot?.rates[activeCurrency]
    const formattedBalance = parseFloat(printableUsdc(spendableBalance ?? 0n))

    const sourceForRouting = activeDirection === 'add' ? activeCurrency : 'USD'
    const destinationForRouting = activeDirection === 'add' ? 'USD' : activeCurrency
    const destination = getExchangeRateWidgetRedirectRoute(
        sourceForRouting,
        destinationForRouting,
        formattedBalance,
        unlockedRegionPaths,
        native.isCapacitor
    )
    const goesToAddMoney = destination.startsWith('/add-money')

    const handleCtaClick = () => {
        if (balancePending) return
        const redirectRoute = getExchangeRateWidgetRedirectRoute(
            sourceForRouting,
            destinationForRouting,
            formattedBalance,
            unlockedRegionPaths
        )
        const currentUrl =
            typeof window !== 'undefined'
                ? `${window.location.pathname}${window.location.search}`
                : '/profile/exchange-rate'
        router.push(withReturnTo(redirectRoute, currentUrl))
    }

    const handleBack = () => {
        if (subView !== 'main') {
            void setQuery({ view: 'main' })
            return
        }
        onBackToSettings()
    }

    const headerTitle =
        subView === 'compare' ? t('compare.pageTitle') : subView === 'all' ? t('allCurrencies.pageTitle') : t('title')

    const dec = RATE_DECIMALS[activeCurrency]

    return (
        <PageContainer>
            <PageStack>
                <NavHeader title={headerTitle} onPrev={handleBack} />

                {subView === 'main' && (
                    <div className="flex flex-col gap-4">
                        <Tabs
                            aria-label={t('title')}
                            fullWidth="stretch"
                            value={activeTab}
                            onValueChange={(next) => void setQuery({ tab: next === 'fees' ? 'fees' : 'rates' })}
                            tabs={[
                                { value: 'rates', label: t('tabs.rates') },
                                { value: 'fees', label: t('tabs.fees') },
                            ]}
                        />

                        {activeTab === 'rates' ? (
                            <div className="flex flex-col gap-4">
                                <RateConverterCard
                                    currency={activeCurrency}
                                    direction={activeDirection}
                                    amountInput={amountInput}
                                    onAmountChange={(value) =>
                                        setAmountOverrides((prev) => ({ ...prev, [amountKey]: value }))
                                    }
                                    onSwapDirection={() =>
                                        void setQuery({
                                            dir: activeDirection === 'add' ? 'withdraw' : 'add',
                                            from: '',
                                            to: '',
                                        })
                                    }
                                    rateEntry={rateEntry}
                                    rateLoading={ratesLoading}
                                    feeSchedule={feeSchedule}
                                    userCountryCode={userCountryCode}
                                    ctaLabel={goesToAddMoney ? t('addMoneyCta') : t('tryIt')}
                                    ctaDisabled={balancePending}
                                    onCtaClick={handleCtaClick}
                                />

                                <ListGroup>
                                    {hasBenchmarks && (
                                        <ListItem
                                            title={t('compare.title')}
                                            body={t('compare.subtitle')}
                                            leading={<IconBubble {...CONCEPT_ICONS.exchange} size="s" />}
                                            chevron
                                            onClick={() => void setQuery({ view: 'compare' })}
                                            data-testid="rates-open-compare"
                                        />
                                    )}
                                    <ListItem
                                        title={t('allCurrencies.title')}
                                        body={t('allCurrencies.subtitle')}
                                        leading={<IconBubble {...CONCEPT_ICONS.otherCountries} size="s" />}
                                        chevron
                                        onClick={() => void setQuery({ view: 'all' })}
                                        data-testid="rates-open-all"
                                    />
                                </ListGroup>
                            </div>
                        ) : (
                            <FeesScheduleView schedule={feeSchedule} />
                        )}
                    </div>
                )}

                {subView === 'compare' && (
                    <div className="flex flex-col gap-4">
                        <Card className="divide-y divide-dashed divide-border-default px-4">
                            <DataRow
                                label={t('direction.addShort')}
                                value={
                                    rateEntry
                                        ? `1 USD = ${formatAmountNumber(rateEntry.buyRate, dec, dec, locale)} ${activeCurrency}`
                                        : ''
                                }
                                loading={ratesLoading && !rateEntry}
                            />
                            <DataRow
                                label={t('direction.withdrawQrShort')}
                                value={
                                    rateEntry
                                        ? `1 USD = ${formatAmountNumber(rateEntry.sellRate, dec, dec, locale)} ${activeCurrency}`
                                        : ''
                                }
                                loading={ratesLoading && !rateEntry}
                            />
                        </Card>

                        <div className="flex flex-col gap-2">
                            <h2 className="px-0.5 text-label-l text-foreground-primary">{t('benchmarks.heading')}</h2>
                            <Card className="px-4 py-1">
                                <MarketBenchmarksList
                                    benchmarks={benchmarksData?.benchmarks ?? []}
                                    source={benchmarksData?.source}
                                    loading={benchmarksLoading}
                                />
                            </Card>
                        </div>
                    </div>
                )}

                {subView === 'all' && (
                    <AllCurrenciesView
                        rates={ratesSnapshot?.rates}
                        userCountryCode={userCountryCode}
                        loading={ratesLoading}
                        onSelectCurrency={(selected) =>
                            void setQuery({
                                cur: selected,
                                view: 'main',
                                tab: 'rates',
                                from: '',
                                to: '',
                            })
                        }
                    />
                )}
            </PageStack>
        </PageContainer>
    )
}
