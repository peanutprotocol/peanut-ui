'use client'

import { useTranslations } from 'next-intl'
import { PROVIDERS } from '@/constants/providers.consts'
import type { ProviderLabel } from '@/types/provider.types'
import { twMerge } from '@/utils/tw'
import { ProviderHelp, type ProviderHelpProps } from './ProviderHelp'

interface ProviderFinePrintProps extends ProviderHelpProps {
    label?: ProviderLabel
}

/** "Provider · Manteca (?)" as one muted, centered line, for screens with no details card to hold a row. */
export const ProviderFinePrint = ({ label = 'provider', className, ...help }: ProviderFinePrintProps) => {
    const t = useTranslations('provider')

    return (
        <p
            className={twMerge(
                'flex items-center justify-center gap-1.5 text-body-xs text-foreground-secondary',
                className
            )}
        >
            <span>
                {t(`label.${label}`)} · {PROVIDERS[help.providerId].brand}
            </span>
            <ProviderHelp {...help} className="text-foreground-secondary" />
        </p>
    )
}
