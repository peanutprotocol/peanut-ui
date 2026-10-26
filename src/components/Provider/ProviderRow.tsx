'use client'

import { useTranslations } from 'next-intl'
import { DataRow } from '@/components/0_Bruddle/DataRow'
import { PROVIDERS } from '@/constants/providers.consts'
import type { ProviderLabel } from '@/types/provider.types'
import { ProviderHelp, type ProviderHelpProps } from './ProviderHelp'

interface ProviderRowProps extends Omit<ProviderHelpProps, 'className'> {
    /** Provider for money, Account provider for accounts, Card provider for the card */
    label?: ProviderLabel
}

/** "Provider · Bridge (?)" as a DataRow inside a details card. The (?) opens the provider's legal details. */
export const ProviderRow = ({ label = 'provider', ...help }: ProviderRowProps) => {
    const t = useTranslations('provider')

    return (
        <DataRow
            label={t(`label.${label}`)}
            value={PROVIDERS[help.providerId].brand}
            trailing={<ProviderHelp {...help} />}
        />
    )
}
