'use client'

import { useAppTranslations } from '@/i18n/app/useAppTranslations'
import DisplayIcon from '@/components/Global/DisplayIcon'
import { DataRow } from '@/components/0_Bruddle/DataRow'
import { type TransactionDetails } from '@/components/TransactionDetails/transactionTransformer'
import { useTokenDisplay } from '@/components/TransactionDetails/useTokenDisplay'

/**
 * Token-and-network row for the details card. Owns the token icon lookup
 * (wire data first, CoinGecko fallback) via useTokenDisplay. A known symbol
 * renders at once with the fallback icon, so a slow or failed lookup never
 * hides it; with no symbol yet, nothing renders.
 * There is no token-amount row: it printed the USD amount with no unit, and
 * the conversion row states the token amount.
 */
export function ReceiptTokenRows({
    transaction,
    isPeanutWalletToken,
}: {
    transaction: TransactionDetails
    isPeanutWalletToken: boolean
}) {
    const t = useAppTranslations('transaction')
    const tokenData = useTokenDisplay(transaction)

    if (!transaction.tokenDisplayDetails || !tokenData) return null

    return (
        <>
            {!isPeanutWalletToken && (
                <DataRow
                    label={t('rows.tokenAndNetwork')}
                    value={
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
                                            className="rounded-full border-2 border-background-default"
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
                    }
                />
            )}
        </>
    )
}
