'use client'

import { useLocale, useTranslations } from 'next-intl'
import { DataRow } from '@/components/0_Bruddle/DataRow'
import { formatAmountNumber } from '@/utils/currency'
import type { FxBenchmarkEntry, FxBenchmarkKey } from '@/utils/fx.utils'

interface MarketBenchmarksListProps {
    benchmarks: readonly FxBenchmarkEntry[]
    source?: string
    loading?: boolean
}

const BENCHMARK_LABEL_KEY = {
    cripto: 'benchmarks.cripto',
    mep: 'benchmarks.mep',
    blue: 'benchmarks.blue',
    tarjeta: 'benchmarks.tarjeta',
    oficial: 'benchmarks.oficial',
} as const satisfies Record<FxBenchmarkKey, string>

export function MarketBenchmarksList({ benchmarks, source, loading = false }: MarketBenchmarksListProps) {
    const t = useTranslations('exchangeRate')
    const locale = useLocale()

    if (loading) {
        return (
            <div className="divide-y divide-dashed divide-border-default">
                <DataRow label={t('benchmarks.cripto')} value="" loading />
                <DataRow label={t('benchmarks.mep')} value="" loading />
                <DataRow label={t('benchmarks.blue')} value="" loading />
            </div>
        )
    }

    if (benchmarks.length === 0) return null

    const formatCell = (entry: FxBenchmarkEntry) => {
        const sell = formatAmountNumber(entry.sell, 0, 0, locale)
        if (entry.buy === null) return `${sell} ARS`
        const buy = formatAmountNumber(entry.buy, 0, 0, locale)
        return `${buy} / ${sell}`
    }

    return (
        <div className="flex flex-col gap-2">
            <div className="divide-y divide-dashed divide-border-default">
                {benchmarks.map((entry) => (
                    <DataRow key={entry.key} label={t(BENCHMARK_LABEL_KEY[entry.key])} value={formatCell(entry)} />
                ))}
            </div>
            {source && (
                <p className="text-body-xs text-foreground-secondary">{t('benchmarks.sourceNote', { source })}</p>
            )}
        </div>
    )
}
