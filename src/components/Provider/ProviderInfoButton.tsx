'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Icon } from '@/components/Global/Icons/Icon'
import { PROVIDERS } from '@/constants/providers.consts'
import type { ProviderId } from '@/types/provider.types'
import { ProviderSheet } from './ProviderSheet'

interface ProviderInfoButtonProps {
    providerId: ProviderId
    nested?: boolean
    pooledAccount?: boolean
    /** shown before the user accepts the provider's terms: the relationship line speaks of it as ahead */
    prospective?: boolean
}

/** The (i) next to a provider name. Opens the provider's legal details. */
export const ProviderInfoButton = ({ providerId, nested, pooledAccount, prospective }: ProviderInfoButtonProps) => {
    const t = useTranslations('provider')
    const [open, setOpen] = useState(false)

    return (
        <>
            <button
                type="button"
                aria-label={t('about', { brand: PROVIDERS[providerId].brand })}
                className="relative inline-flex shrink-0 items-center text-foreground-secondary after:absolute after:-inset-3.5 focus-visible:outline-[3px] focus-visible:outline-action-focus"
                onClick={(event) => {
                    // the row around it may be tappable too
                    event.stopPropagation()
                    setOpen(true)
                }}
            >
                <Icon name="info" size={16} />
            </button>
            <ProviderSheet
                providerId={providerId}
                open={open}
                onClose={() => setOpen(false)}
                nested={nested}
                pooledAccount={pooledAccount}
                prospective={prospective}
            />
        </>
    )
}
