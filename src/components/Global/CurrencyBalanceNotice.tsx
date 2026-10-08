'use client'

import { useQuery } from '@tanstack/react-query'
import { formatUnits } from 'viem'
import { useOptionalAuth } from '@/context/authContext'
import { useWallet } from '@/hooks/wallet/useWallet'
import { currencyAccountsKey, eurcBalanceQueryOptions } from '@/hooks/wallet/useCurrencyAccounts'
import { currencyAccountsApi } from '@/services/currency-accounts'
import { useAppTranslations } from '@/i18n/app/useAppTranslations'
import { LinkButton } from '@/components/0_Bruddle/LinkButton'
import { convertedAccountTotal, displayAccountUnits, sendAmountUnits } from '@/utils/converted-balance'

type Props = { currency: 'USDC' | 'EURC'; amount: string; showSelectedBalance?: boolean }

export function CurrencyBalanceNotice(props: Props) {
    const auth = useOptionalAuth()
    return auth?.userId ? <OwnedCurrencyBalanceNotice key={auth.userId} userId={auth.userId} {...props} /> : null
}

function OwnedCurrencyBalanceNotice({ userId, currency, amount, showSelectedBalance }: Props & { userId: string }) {
    const t = useAppTranslations('currencyAccounts')
    const { spendableBalance: usdBalance, isFetchingSpendableBalance } = useWallet()
    const accounts = useQuery({
        queryKey: currencyAccountsKey(userId),
        queryFn: currencyAccountsApi.list,
        staleTime: 30_000,
        retry: 1,
    })
    const eurcAccount = accounts.data?.accounts.find((account) => account.asset === 'EURC')
    const eurc = useQuery(eurcBalanceQueryOptions(userId, eurcAccount))
    const selected = currency === 'USDC' ? usdBalance : eurc.data
    const selectedReady = currency === 'USDC' ? !isFetchingSpendableBalance : eurc.isSuccess
    const requested = sendAmountUnits(amount)
    const insufficient = selectedReady && selected !== undefined && requested !== undefined && requested > selected
    const other = currency === 'USDC' ? eurc.data : usdBalance
    const otherReady = currency === 'USDC' ? eurc.isSuccess : !isFetchingSpendableBalance
    // Convert the OTHER account into the sending currency, not the reverse quote.
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
            ? convertedAccountTotal(selected, other, rate.data.midmarket_rate)
            : undefined
    const unavailable = accounts.isError || eurc.isError || rate.isError || (freshRate && total === undefined)
    const retry = () => {
        void accounts.refetch()
        if (eurcAccount) void eurc.refetch()
        if (insufficient && eurcAccount && other !== undefined && otherReady) void rate.refetch()
    }
    return (
        <div className="flex flex-col items-center gap-1 text-body-s text-foreground-secondary" aria-live="polite">
            {showSelectedBalance && selected !== undefined && selectedReady && (
                <p>{t('sendCurrencyBalance', { amount: formatUnits(selected, 6), currency })}</p>
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
