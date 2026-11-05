'use client'

import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { Callout } from '@/components/0_Bruddle/Callout'
import { type TransactionDetails } from '@/components/TransactionDetails/transactionTransformer'
import { aveniaNewKeyUrl } from '@/features/avenia/aveniaRecovery'

/**
 * On the receipt of an Avenia withdrawal whose payout the bank refused for its
 * key or account: the money waits with Avenia, and the CTA opens the new-key
 * screen. Renders nothing on any other receipt.
 */
export function AveniaNewKeyNotice({ transaction }: { transaction: TransactionDetails }) {
    const t = useTranslations('avenia.recovery')
    const router = useRouter()
    if (!transaction.extraDataForDrawer?.awaitsNewPixKey) return null
    return (
        <Callout
            priority="attention"
            data-testid="avenia-new-key-notice"
            ctas={[{ label: t('addKey'), onClick: () => router.push(aveniaNewKeyUrl(transaction.id)) }]}
        >
            {t('notice')}
        </Callout>
    )
}
