'use client'

import { useTranslations } from 'next-intl'
import { PROVIDERS } from '@/constants/providers.consts'
import type { ProviderId, ProviderRowLabel } from '@/types/provider.types'
import { twMerge } from '@/utils/tw'
import { ProviderInfoButton } from './ProviderInfoButton'

const NOTE_KEY: Record<ProviderRowLabel, 'note' | 'noteAccountProvider' | 'noteCardIssuer'> = {
    provider: 'note',
    accountProvider: 'noteAccountProvider',
    cardIssuer: 'noteCardIssuer',
}

interface ProviderNoteProps {
    providerId: ProviderId
    nested?: boolean
    pooledAccount?: boolean
    /** shown before the user accepts the provider's terms: the relationship line speaks of it as ahead */
    prospective?: boolean
    /** the card screen names Third National as the card issuer, not a provider */
    label?: ProviderRowLabel
    className?: string
}

/** One muted line, "Provider: Bridge (i)", for places that are not cards. Aligns with its parent; pass `justify-center` to centre it. */
export const ProviderNote = ({
    providerId,
    nested,
    pooledAccount,
    prospective,
    label = 'provider',
    className,
}: ProviderNoteProps) => {
    const t = useTranslations('provider')
    return (
        <p className={twMerge('flex items-center gap-1 text-body-xs text-foreground-secondary', className)}>
            {t(NOTE_KEY[label], { brand: PROVIDERS[providerId].brand })}
            <ProviderInfoButton
                providerId={providerId}
                nested={nested}
                pooledAccount={pooledAccount}
                prospective={prospective}
            />
        </p>
    )
}
