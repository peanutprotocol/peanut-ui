'use client'

import { useTranslations } from 'next-intl'
import { DataRow } from '@/components/0_Bruddle/DataRow'
import { PaymentInfoRow } from '@/components/Payment/PaymentInfoRow'
import { PROVIDERS } from '@/constants/providers.consts'
import type { ProviderId, ProviderRowLabel } from '@/types/provider.types'
import { ProviderInfoButton } from './ProviderInfoButton'

interface ProviderRowProps {
    providerId: ProviderId
    label?: ProviderRowLabel
    /** set when the row sits inside a drawer, so the sheet stacks on top */
    nested?: boolean
    /** 'stacked' matches PaymentInfoRow cards; a card never mixes row shapes */
    variant?: 'inline' | 'stacked'
    pooledAccount?: boolean
    /** stacked only: PaymentInfoRow owns its own bottom border */
    hideBottomBorder?: boolean
}

/** "Provider · Bridge (?)" row for receipts and confirm cards. */
export const ProviderRow = ({
    providerId,
    label = 'provider',
    nested,
    variant = 'inline',
    pooledAccount,
    hideBottomBorder,
}: ProviderRowProps) => {
    const t = useTranslations('provider')
    const brand = PROVIDERS[providerId].brand
    const button = <ProviderInfoButton providerId={providerId} nested={nested} pooledAccount={pooledAccount} />

    if (variant === 'stacked') {
        return (
            <PaymentInfoRow
                label={t(`label.${label}`)}
                hideBottomBorder={hideBottomBorder}
                value={
                    <span className="inline-flex items-center gap-2">
                        {brand}
                        {button}
                    </span>
                }
            />
        )
    }
    return <DataRow label={t(`label.${label}`)} value={brand} trailing={button} />
}
