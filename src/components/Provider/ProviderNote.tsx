'use client'

import { type ReactNode, useState } from 'react'
import { useTranslations } from 'next-intl'
import { LinkButton } from '@/components/0_Bruddle/LinkButton'
import { PROVIDERS } from '@/constants/providers.consts'
import type { ProviderFinePrint, ProviderId, ProviderRole } from '@/types/provider.types'
import { twMerge } from '@/utils/tw'
import { ProviderSheet } from './ProviderSheet'

// sumsub has no line: it only shows inside the bridge sheet
const DEFAULT_LINE: Partial<Record<ProviderRole, ProviderFinePrint>> = {
    bridge: 'bankTransfers',
    manteca: 'payments',
    rhino: 'crossChain',
    thirdNational: 'card',
}

interface ProviderNoteProps {
    providerId: ProviderId
    /** the sentence before "About <brand>"; defaults to the provider's service */
    line?: ProviderFinePrint
    /** fills `{currency}` in the account line */
    currency?: string
    /** set when the note sits inside a drawer, so the sheet stacks on top */
    nested?: boolean
    pooledAccount?: boolean
    /** shown before the user accepts the provider's terms: the relationship line speaks of it as ahead */
    prospective?: boolean
    /** another sentence for the same line, placed before "About <brand>" */
    children?: ReactNode
    className?: string
}

/** Fine print at the end of a screen: "Bank transfers by Bridge. About Bridge". The link opens the provider's legal details. */
export const ProviderNote = ({
    providerId,
    line,
    currency,
    nested,
    pooledAccount,
    prospective,
    children,
    className,
}: ProviderNoteProps) => {
    const t = useTranslations('provider')
    const [open, setOpen] = useState(false)
    const { brand, role } = PROVIDERS[providerId]
    const key = line ?? DEFAULT_LINE[role]
    if (!key) return null

    return (
        <>
            <p className={twMerge('text-center text-body-xs text-foreground-secondary', className)}>
                {t(`finePrint.${key}`, { brand, currency: currency ?? '' })} {children && <>{children} </>}
                <LinkButton onClick={() => setOpen(true)}>{t('about', { brand })}</LinkButton>
            </p>
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
