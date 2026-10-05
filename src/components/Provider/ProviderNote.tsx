'use client'

import { useTranslations } from 'next-intl'
import { PROVIDERS } from '@/constants/providers.consts'
import type { ProviderId } from '@/types/provider.types'
import { twMerge } from '@/utils/tw'
import { ProviderInfoButton } from './ProviderInfoButton'

interface ProviderNoteProps {
    providerId: ProviderId
    nested?: boolean
    pooledAccount?: boolean
    /** the card screen names Third National as the card issuer, not a provider */
    label?: 'provider' | 'cardIssuer'
    className?: string
}

/** One muted line, "Provider: Bridge (?)", for places that are not cards. */
export const ProviderNote = ({
    providerId,
    nested,
    pooledAccount,
    label = 'provider',
    className,
}: ProviderNoteProps) => {
    const t = useTranslations('provider')
    return (
        <p
            className={twMerge(
                'flex items-center justify-center gap-1 text-body-xs text-foreground-secondary',
                className
            )}
        >
            {t(label === 'cardIssuer' ? 'noteCardIssuer' : 'note', { brand: PROVIDERS[providerId].brand })}
            <ProviderInfoButton providerId={providerId} nested={nested} pooledAccount={pooledAccount} />
        </p>
    )
}
