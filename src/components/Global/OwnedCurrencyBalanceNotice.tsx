'use client'

import { useQuery } from '@tanstack/react-query'
import { formatUnits } from 'viem'
import { useWallet } from '@/hooks/wallet/useWallet'
import { currencyAccountsKey, eurcBalanceQueryOptions } from '@/utils/currency-account-queries'
import { currencyAccountsApi } from '@/services/currency-accounts'
import { useAppTranslations } from '@/i18n/app/useAppTranslations'
import { LinkButton } from '@/components/0_Bruddle/LinkButton'
import type { CurrencyBalanceNoticeProps } from '@/components/Global/CurrencyBalanceNotice.types'
import { convertedAccountTotal, displayAccountUnits, sendAmountUnits } from '@/utils/converted-balance'

export function OwnedCurrencyBalanceNotice({
    userId,
    currency,
    amount,
    showSelectedBalance,
    availableBalance,
}: CurrencyBalanceNoticeProps & { userId: string }) {
    const t = useAppTranslations('currencyAccounts')
    const { liveSpendableBalance: usdBalance, isSpendableBalanceUnavailable, refetchSpendableBalance } = useWallet()
    const accounts = useQuery({
        queryKey: currencyAccountsKey(userId),
        queryFn: currencyAccountsApi.list,
        staleTime: 30_000,
        retry: 1,
    })
    const eurcAccount = accounts.data?.accounts.find((account) => account.asset === 'EURC')
    const eurc = useQuery(eurcBalanceQueryOptions(userId, eurcAccount))
    const selected = currency === 'USDC' ? (availableBalance ?? usdBalance) : eurc.data
    const selectedReady = currency === 'USDC' ? usdBalance !== undefined : eurc.isSuccess
    const requested = sendAmountUnits(amount)
    const insufficient = selectedReady && selected !== undefined && requested !== undefined && requested > selected
    const other = currency === 'USDC' ? eurc.data : usdBalance
    const otherReady = currency === 'USDC' ? eurc.isSuccess : usdBalance !== undefined
    const from = currency === 'USDC' ? 'EURC' : 'USDC'
    const rate = useQuery({
        queryKey: ['currency-rate', userId, from],
        queryFn: () => currencyAccountsApi.exchangeRate(from),
        enabled: insufficient && !!eurcAccount && other !== undefined && otherReady,
        staleTime: 15_000,
        refetchInterval: insufficient ? 30_000 : false,
        retry: 1,
    })
    const freshRate = rate.isSuccess && Date.now() - rate.dataUpdatedAt <= 60_000
    const total =
        freshRate && selected !== undefined && other !== undefined && otherReady
            ? convertedAccountTotal(selected, other, rate.data.sell_rate)
            : undefined
    const unavailable =
        accounts.isError ||
        eurc.isError ||
        rate.isError ||
        isSpendableBalanceUnavailable ||
        (freshRate && total === undefined)
    const retry = () => {
        void refetchSpendableBalance()
        void accounts.refetch()
        if (eurcAccount) void eurc.refetch()
        if (insufficient && eurcAccount) void rate.refetch()
    }
    return (
        <div className="flex flex-col items-center gap-1 text-body-s text-foreground-secondary" aria-live="polite">
            {showSelectedBalance && selected !== undefined && selectedReady && (
                <p>
                    {t('sendCurrencyBalance', {
                        amount: formatUnits(selected, 6),
                        currency: currency === 'EURC' ? 'EUR' : 'USD',
                    })}
                </p>
            )}
            {showSelectedBalance && (accounts.isError || eurc.isError) && (
                <>
                    <p>{t('balanceError')}</p>
                    <LinkButton className="my-3" onClick={retry}>
                        {t('retry')}
                    </LinkButton>
                </>
            )}
            {insufficient &&
                (eurcAccount || accounts.isPending || accounts.isError) &&
                (total !== undefined && !unavailable ? (
                    <>
                        <p>
                            {t('convertedTotalBalance', {
                                amount: displayAccountUnits(total),
                                currency: currency === 'USDC' ? 'USD' : 'EUR',
                            })}
                        </p>
                        <p>{t('convertedBalanceWarning')}</p>
                    </>
                ) : unavailable ? (
                    <>
                        <p>{t('convertedBalanceUnavailable')}</p>
                        <LinkButton className="my-3" onClick={retry}>
                            {t('retry')}
                        </LinkButton>
                    </>
                ) : (
                    <p>{t('convertedBalanceLoading')}</p>
                ))}
        </div>
    )
}
