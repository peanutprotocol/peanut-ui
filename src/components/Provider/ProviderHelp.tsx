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
    /** the sheet opened or closed, for the analytics of the screen it sits on */
    onOpenChange?: (open: boolean) => void
    /** a terms or privacy link in the sheet was opened */
    onDocumentClick?: (document: 'terms' | 'privacy') => void
}

/** The (?) beside a provider's name. It opens the sheet with the provider's legal details. */
export const ProviderHelp = ({
    providerId,
    nested,
    prospective,
    className,
    onOpenChange,
    onDocumentClick,
}: ProviderHelpProps) => {
    const t = useTranslations('provider')
    const [open, setOpen] = useState(false)

    return (
        <>
            <button
                type="button"
                aria-label={t('about', { brand: PROVIDERS[providerId].brand })}
                // the (?) has no visible text: a capture taps it by this id in every locale
                data-testid="provider-help"
                onClick={(event) => {
                    // the row it sits on may be a button of its own
                    event.stopPropagation()
                    setOpen(true)
                    onOpenChange?.(true)
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
                onClose={() => {
                    setOpen(false)
                    onOpenChange?.(false)
                }}
                nested={nested}
                prospective={prospective}
                onDocumentClick={onDocumentClick}
            />
        </>
    )
}
