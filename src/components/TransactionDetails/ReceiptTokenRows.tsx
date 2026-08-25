'use client'

import { useAppTranslations } from '@/i18n/app/useAppTranslations'
import DisplayIcon from '@/components/Global/DisplayIcon'
import { DataRow } from '@/components/0_Bruddle/DataRow'
import { type TransactionDetails } from '@/components/TransactionDetails/transactionTransformer'
import { useTokenDisplay } from '@/components/TransactionDetails/useTokenDisplay'
import { isStableCoin } from '@/utils/general.utils'

/**
 * Token amount + token-and-network rows for the details card. Owns the token
 * icon lookup (wire data first, CoinGecko fallback) via useTokenDisplay and
 * renders nothing until icon + symbol resolve — same gate as the legacy
 * receipt.
 */
export function ReceiptTokenRows({
    transaction,
    isPeanutWalletToken,
}: {
    transaction: TransactionDetails
    isPeanutWalletToken: boolean
}) {
    const t = useAppTranslations('transaction')
    const { tokenData, isLoading } = useTokenDisplay(transaction)

    // keep the row (with its skeleton) while the fallback lookup is in flight;
    // drop it only when the lookup settled without usable icon + symbol
    if (!transaction.tokenDisplayDetails || (!isLoading && (!tokenData?.icon || !tokenData?.symbol))) return null

    return (
        <>
            {!isStableCoin(transaction.tokenSymbol ?? 'USDC') && (
                <DataRow label={t('rows.tokenAmount')} value={transaction.amount} />
            )}
            {!isPeanutWalletToken && (
                <DataRow
                    label={t('rows.tokenAndNetwork')}
                    value={
                        isLoading || !tokenData ? (
                            <div className="h-6 w-32 animate-pulse rounded-sm bg-background-disabled" />
                        ) : (
                            <div className="flex items-center gap-2">
                                <div className="relative flex h-6 w-6 min-w-[24px] items-center justify-center">
                                    {/* Main token icon */}
                                    <DisplayIcon
                                        iconUrl={tokenData.icon}
                                        altText={tokenData.symbol || 'token'}
                                        fallbackName={tokenData.symbol || 'T'}
                                        sizeClass="h-6 w-6"
                                    />
                                    {/* Smaller chain icon, absolutely positioned */}
                                    {transaction.tokenDisplayDetails.chainIconUrl && (
                                        <div className="absolute -right-1 -bottom-1">
                                            <DisplayIcon
                                                iconUrl={transaction.tokenDisplayDetails.chainIconUrl}
                                                altText={transaction.tokenDisplayDetails.chainName || 'chain'}
                                                fallbackName={transaction.tokenDisplayDetails.chainName || 'C'}
                                                sizeClass="h-3.5 w-3.5 text-[7px]"
                                                className="rounded-round border-2 border-background-default"
                                            />
                                        </div>
                                    )}
                                </div>
                                <span>
                                    {t('rows.tokenOnChain', {
                                        token: tokenData.symbol.toUpperCase(),
                                        chain: transaction.tokenDisplayDetails.chainName ?? '',
                                    })}
                                </span>
                            </div>
                        )
                    }
                />
            )}
        </>
    )
}
