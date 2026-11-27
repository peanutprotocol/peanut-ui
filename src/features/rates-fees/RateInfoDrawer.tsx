'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useLocale, useTranslations } from 'next-intl'
import { Accordion } from '@/components/0_Bruddle/Accordion'
import { Card } from '@/components/0_Bruddle/Card'
import { DataRow } from '@/components/0_Bruddle/DataRow'
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/Global/Drawer'
import { Icon } from '@/components/Global/Icons/Icon'
import { getCurrencyFlagUrl } from '@/constants/countryCurrencyMapping'
import { toSupportedExchangeCurrency } from '@/constants/exchange-currencies.consts'
import { formatAmountNumber } from '@/utils/currency'
import { twMerge } from '@/utils/tw'
import { MarketBenchmarksList } from './MarketBenchmarksList'
import { BENCHMARK_CURRENCIES, QR_ENABLED_CURRENCIES, RATE_DECIMALS } from './rates-fees.utils'
import { useAllDisplayRates, useReferenceBenchmarks } from './useRatesAndFees'

export type RateLockMode = 'cbu' | 'qr' | 'indicative'

interface RateInfoDrawerProps {
    open: boolean
    onClose: () => void
    currency: string
    /** Locked buy or sell rate shown on the underlying flow screen, when present. */
    lockedRate?: number | null
    lockMode?: RateLockMode
    nested?: boolean
}

/**
 * Slim in-flow bottom drawer opened from `(?)` next to an exchange-rate row on
 * CBU deposit and QR pay confirmation screens (same Vaul `<Drawer>` pattern as
 * `ProviderSheet`). Keeps the user inside their transfer flow while showing
 * Buy/Sell rates and a collapsed Accordion for ARS market benchmarks.
 */
export function RateInfoDrawer({
    open,
    onClose,
    currency,
    lockedRate,
    lockMode = 'indicative',
    nested,
}: RateInfoDrawerProps) {
    const t = useTranslations('exchangeRate')
    const locale = useLocale()
    const [benchmarksOpen, setBenchmarksOpen] = useState(false)

    const code = currency.toUpperCase()
    const supported = toSupportedExchangeCurrency(code)
    const decimals = supported ? RATE_DECIMALS[supported] : 2
    const flagUrl = getCurrencyFlagUrl(code)
    const hasBenchmarks = supported !== null && BENCHMARK_CURRENCIES.has(supported)
    const hasQr = supported !== null && QR_ENABLED_CURRENCIES.has(supported)

    const { data: ratesSnapshot, isLoading: ratesLoading } = useAllDisplayRates()
    const { data: benchmarkData, isLoading: benchmarksLoading } = useReferenceBenchmarks(
        supported,
        open && hasBenchmarks && benchmarksOpen
    )

    const entry = ratesSnapshot?.rates[code]
    const buyRate = lockMode === 'cbu' && lockedRate ? lockedRate : entry?.buyRate
    const sellRate = lockMode === 'qr' && lockedRate ? lockedRate : entry?.sellRate

    const subtitleKey =
        lockMode === 'cbu' ? 'drawer.subtitleCbu' : lockMode === 'qr' ? 'drawer.subtitleQr' : 'drawer.subtitleLive'

    const formatRate = (value: number | undefined) =>
        value && Number.isFinite(value)
            ? `1 USD = ${formatAmountNumber(value, decimals, decimals, locale)} ${code}`
            : ''

    return (
        <Drawer open={open} onOpenChange={(next) => !next && onClose()} nested={nested}>
            <DrawerContent className="px-4 pb-6">
                <DrawerHeader className="px-0 pt-2 pb-3 text-left">
                    <div className="flex items-center gap-3">
                        {flagUrl && (
                            <Image
                                src={flagUrl}
                                alt={code}
                                width={32}
                                height={32}
                                className="size-8 shrink-0 rounded-full object-cover"
                            />
                        )}
                        <div className="min-w-0">
                            <DrawerTitle className="text-heading-card text-foreground-primary">
                                {t('drawer.title', { currency: code })}
                            </DrawerTitle>
                            <DrawerDescription className="text-body-xs text-foreground-secondary">
                                {t(subtitleKey)}
                            </DrawerDescription>
                        </div>
                    </div>
                </DrawerHeader>

                <div className="flex flex-col gap-3">
                    <Card className="divide-y divide-dashed divide-border-default px-4">
                        <DataRow
                            label={t('direction.addShort')}
                            value={formatRate(buyRate)}
                            loading={ratesLoading && !buyRate}
                        />
                        <DataRow
                            label={hasQr ? t('direction.withdrawQrShort') : t('direction.withdrawShort')}
                            value={formatRate(sellRate)}
                            loading={ratesLoading && !sellRate}
                        />
                    </Card>

                    {hasBenchmarks && (
                        <Accordion
                            type="single"
                            collapsible
                            onValueChange={(value) => setBenchmarksOpen(value === 'benchmarks')}
                        >
                            <Accordion.Item value="benchmarks">
                                <Accordion.Trigger title={t('compare.title')} />
                                <Accordion.Content className="px-4 pb-3">
                                    <MarketBenchmarksList
                                        benchmarks={benchmarkData?.benchmarks ?? []}
                                        source={benchmarkData?.source}
                                        loading={benchmarksLoading}
                                    />
                                </Accordion.Content>
                            </Accordion.Item>
                        </Accordion>
                    )}
                </div>
            </DrawerContent>
        </Drawer>
    )
}

interface RateHelpTriggerProps {
    currency: string
    lockedRate?: number | null
    lockMode?: RateLockMode
    nested?: boolean
    className?: string
}

/** The `(?)` trigger beside an exchange-rate label; matches `ProviderHelp` hit area and icon sizing. */
export function RateHelpTrigger({ currency, lockedRate, lockMode, nested, className }: RateHelpTriggerProps) {
    const t = useTranslations('exchangeRate')
    const [open, setOpen] = useState(false)

    return (
        <>
            <button
                type="button"
                aria-label={t('drawer.openAria', { currency: currency.toUpperCase() })}
                data-testid="rate-help"
                onClick={(event) => {
                    event.stopPropagation()
                    setOpen(true)
                }}
                className={twMerge(
                    'relative -m-1 inline-flex size-6 shrink-0 items-center justify-center rounded-full text-foreground-primary after:absolute after:-inset-2 focus-visible:outline-[3px] focus-visible:outline-offset-1 focus-visible:outline-action-focus',
                    className
                )}
            >
                <Icon name="question-mark" size={16} />
            </button>
            {open && (
                <RateInfoDrawer
                    open={open}
                    onClose={() => setOpen(false)}
                    currency={currency}
                    lockedRate={lockedRate}
                    lockMode={lockMode}
                    nested={nested}
                />
            )}
        </>
    )
}
