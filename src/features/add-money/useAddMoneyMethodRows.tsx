'use client'

import type { ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { CONCEPT_ICONS } from '@/components/0_Bruddle/conceptIcons'
import { CorridorFlag } from '@/features/deposit-accounts/components/CorridorFlag'
import { DEPOSIT_RAILS } from '@/features/deposit-accounts/rails'
import type { AddMoneyPickerMethod } from './addMoneyMethods'

const ARS_RAIL = DEPOSIT_RAILS.BANK_TRANSFER_AR

export type AddMoneyMethodRow = { title: string; description: string; icon: ReactNode }

/** the Add list's rows, shared by the Add list (picker, card funding) and the verified page */
export function useAddMoneyMethodRows(): Record<AddMoneyPickerMethod, AddMoneyMethodRow> {
    const t = useTranslations('addMoney.methods')
    return {
        ars: {
            title: ARS_RAIL.currency,
            description: t('arsDetails'),
            icon: <CorridorFlag iso2={ARS_RAIL.flagIso2} />,
        },
        bank: {
            title: t('bankTransfer'),
            description: t('bankDetails'),
            icon: <IconBubble {...CONCEPT_ICONS.bank} size="s" />,
        },
        pix: {
            title: t('pix'),
            description: t('pixDetails'),
            icon: <IconBubble {...CONCEPT_ICONS.pix} size="s" />,
        },
        crypto: {
            title: t('crypto'),
            description: t('cryptoDetails'),
            icon: <IconBubble {...CONCEPT_ICONS.crypto} size="s" />,
        },
    }
}
