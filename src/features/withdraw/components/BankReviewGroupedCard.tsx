'use client'

import { useTranslations } from 'next-intl'
import Card from '@/components/Global/Card'
import { DataRow } from '@/components/0_Bruddle/DataRow'
import { DataRowGroup } from '@/components/0_Bruddle/DataRowGroup'
import { AccountType, type Account } from '@/interfaces/interfaces'
import { formatIban } from '@/utils/general.utils'

interface BankReviewGroupedCardProps {
    bankAccount: Account
    /** Routing number, sort code or CLABE, as the review already derives it. */
    routingOrSortCode: string
    /** null when the payout converts nothing (a USD account). */
    exchangeRate: { value: string; loading: boolean; moreInfoText: string } | null
    fee: string
    /** USD only: when it arrives and what the bank receives. */
    usd: { arrives: string; bankReceives: string } | null
}

/**
 * The pitch rendering of the bank review card (mock/receipt-groups): one
 * `Global/Card`, every row a `DataRow`, the rows grouped by theme in
 * `DataRowGroup`s so the dashed divider falls between groups only.
 * Groups: who is paid | when it arrives (USD) | the money.
 */
export const BankReviewGroupedCard = ({
    bankAccount,
    routingOrSortCode,
    exchangeRate,
    fee,
    usd,
}: BankReviewGroupedCardProps) => {
    const t = useTranslations('withdraw')
    const tCommon = useTranslations('common')
    const owner = bankAccount.details?.accountOwnerName

    return (
        <Card position="solo" className="divide-y divide-dashed divide-border-default px-4 py-0">
            <DataRowGroup>
                {owner && <DataRow label={t('bank.accountOwner')} value={owner} />}
                {bankAccount.type === AccountType.IBAN ? (
                    <>
                        <DataRow
                            label={t('bank.iban')}
                            value={bankAccount.identifier ? formatIban(bankAccount.identifier) : ''}
                        />
                        {bankAccount.bic && <DataRow label={t('bank.bic')} value={bankAccount.bic.toUpperCase()} />}
                    </>
                ) : bankAccount.type === AccountType.CLABE ? (
                    <DataRow label={t('bank.clabe')} value={bankAccount.identifier.toUpperCase()} />
                ) : bankAccount.type === AccountType.CO_BANK_TRANSFER ? (
                    <DataRow label={t('bank.accountNumber')} value={bankAccount.identifier} />
                ) : (
                    <>
                        <DataRow label={t('bank.accountNumber')} value={bankAccount.identifier} />
                        <DataRow
                            label={bankAccount.type === AccountType.GB ? t('bank.sortCode') : t('bank.routingNumber')}
                            value={routingOrSortCode}
                        />
                    </>
                )}
            </DataRowGroup>
            {usd && (
                <DataRowGroup>
                    <DataRow label={t('bank.arrives')} value={usd.arrives} />
                </DataRowGroup>
            )}
            <DataRowGroup>
                {exchangeRate && (
                    <DataRow
                        loading={exchangeRate.loading}
                        label={tCommon('exchangeRate')}
                        value={exchangeRate.value}
                        moreInfoText={exchangeRate.moreInfoText}
                    />
                )}
                <DataRow label={t('bank.fee')} value={fee} />
                {usd && <DataRow label={t('bank.bankReceives')} value={usd.bankReceives} />}
            </DataRowGroup>
        </Card>
    )
}
