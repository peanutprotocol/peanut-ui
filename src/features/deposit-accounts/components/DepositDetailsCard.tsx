import { useTranslations } from 'next-intl'
import { PaymentInfoRow } from '@/components/Payment/PaymentInfoRow'
import Card from '@/components/Global/Card'
import { ProviderHelp } from '@/components/Provider/ProviderHelp'
import { PROVIDERS } from '@/constants/providers.consts'
import type { ProviderId } from '@/types/provider.types'
import type { DepositDetailRow } from '../types'

/**
 * The bank-details card: every field in one card, label above value, a copy
 * icon on each — the shape a payer's own bank uses for the same numbers.
 *
 * One row type for every field. design.md never mixes DataRow and
 * PaymentInfoRow in one card, and a bank or recipient address wraps onto a
 * second line, which only the label-above-value row holds. PaymentInfoRow is
 * the DS row for deposit details and draws its own dashed divider.
 */
export function DepositDetailsCard({
    rows,
    providerId,
}: {
    rows: DepositDetailRow[]
    /** who holds the account; its row closes the card (TASK-23295) */
    providerId?: ProviderId | null
}) {
    const t = useTranslations('provider')
    return (
        <Card position="solo" className="px-4 py-0">
            {rows.map((row, index) => (
                <PaymentInfoRow
                    key={row.label}
                    label={row.label}
                    value={row.value}
                    allowCopy={row.copyable !== false}
                    hideBottomBorder={!providerId && index === rows.length - 1}
                />
            ))}
            {providerId && (
                <PaymentInfoRow
                    hideBottomBorder
                    label={
                        <span className="flex items-center gap-1">
                            {t('label.accountProvider')}
                            <ProviderHelp providerId={providerId} />
                        </span>
                    }
                    value={PROVIDERS[providerId].brand}
                />
            )}
        </Card>
    )
}
