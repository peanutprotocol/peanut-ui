'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Icon } from '@/components/Global/Icons/Icon'
import { PROVIDERS } from '@/constants/providers.consts'
import type { ProviderId } from '@/types/provider.types'
import { twMerge } from '@/utils/tw'
import { ProviderSheet } from './ProviderSheet'

export interface ProviderHelpProps {
    providerId: ProviderId
    /** set when the trigger sits inside a drawer, so the sheet stacks on top */
    nested?: boolean
    /** shown before the user accepts the provider's terms: the sheet speaks of the relationship as ahead */
    prospective?: boolean
    className?: string
}

/** The (?) beside a provider's name. It opens the sheet with the provider's legal details. */
export const ProviderHelp = ({ providerId, nested, prospective, className }: ProviderHelpProps) => {
    const t = useTranslations('provider')
    const [open, setOpen] = useState(false)

    return (
        <>
            <button
                type="button"
                aria-label={t('about', { brand: PROVIDERS[providerId].brand })}
                onClick={(event) => {
                    // the row it sits on may be a button of its own
                    event.stopPropagation()
                    setOpen(true)
                }}
                // after: pseudo-element grows the 16px glyph to the 44px hit area
                className={twMerge(
                    'relative inline-flex shrink-0 items-center rounded text-foreground-primary after:absolute after:-inset-3.5 focus-visible:outline-2 focus-visible:outline-action-focus',
                    className
                )}
            >
                <Icon name="question-mark" size={16} />
            </button>
            <ProviderSheet
                providerId={providerId}
                open={open}
                onClose={() => setOpen(false)}
                nested={nested}
                prospective={prospective}
            />
        </>
    )
}
