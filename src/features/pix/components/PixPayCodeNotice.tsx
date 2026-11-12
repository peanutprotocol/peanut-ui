'use client'

import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/0_Bruddle/Button'
import { type TransactionDetails } from '@/components/TransactionDetails/transactionTransformer'
import { pixDepositCodeUrl } from '@/features/pix/pix.routes'

/**
 * On the receipt of a Pix deposit whose code can still be paid: the
 * button opens that code again, the way the new-key notice opens its screen.
 * Renders nothing on any other receipt. The API sends the code state to the
 * owner only, so a shared receipt never shows it.
 */
export function PixPayCodeNotice({ transaction }: { transaction: TransactionDetails }) {
    const t = useTranslations('pix.deposit')
    const router = useRouter()
    if (!transaction.extraDataForDrawer?.pixCodePayable) return null
    // A button, not a callout: the receipt already says the deposit is pending.
    return (
        <Button
            variant="secondary"
            className="w-full print:hidden"
            data-testid="pix-pay-code-notice"
            onClick={() => router.push(pixDepositCodeUrl(transaction.id))}
        >
            {t('showCode')}
        </Button>
    )
}
