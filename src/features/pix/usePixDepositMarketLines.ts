'use client'

import { useQuery } from '@tanstack/react-query'
import { useFormatter, useTranslations } from 'next-intl'
import { useAuth } from '@/context/authContext'
import { pixApi } from '@/services/pix'
import { formatCurrency } from '@/utils/general.utils'

/**
 * The provider's mid-market rate and its cut of each deposit, as two lines of the standing code
 * screen's list (`GET /pix/deposit/rules`, Bridge's route: API-CONTRACT 8.2). The code never waits
 * for them: without the fields, on a failed answer or while it is out, there are no lines, no error
 * and no spinner. The minimum stays the route's (`pixMinimumBrl`).
 */
export function usePixDepositMarketLines(enabled: boolean): string[] {
    const t = useTranslations('pix.deposit')
    const format = useFormatter()
    const { userId } = useAuth()
    const { data } = useQuery({
        queryKey: ['pix-deposit-rules', userId],
        queryFn: pixApi.depositRules,
        enabled: enabled && !!userId,
        retry: false,
    })
    if (!data?.marketRate || !data.providerFeePercent) return []
    const percent = format.number(Number(data.providerFeePercent) / 100, {
        style: 'percent',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })
    return [
        t('marketRate', { rate: `1 USD = BRL ${formatCurrency(data.marketRate, 4)}` }),
        t('providerFee', { percent }),
    ]
}
