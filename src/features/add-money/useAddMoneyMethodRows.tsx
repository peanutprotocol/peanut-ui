'use client'

import type { ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { CONCEPT_ICONS } from '@/components/0_Bruddle/conceptIcons'
import { CorridorFlag } from '@/features/deposit-accounts/components/CorridorFlag'
import { ARS_ADD_MONEY_PATH, DEPOSIT_RAILS } from '@/features/deposit-accounts/rails'
import { PIX_ADD_MONEY_PATH } from '@/features/pix/pix.routes'
import { rewriteMethodPath } from '@/utils/native-routes'
import { withReturnTo } from '@/utils/return-to.utils'
import type { AddMoneyMethod } from './addMoneyMethods'

const ARS_RAIL = DEPOSIT_RAILS.BANK_TRANSFER_AR
/** the bank hub: its country list routes to the reusable account or the one-time transfer (`useDepositCountryRouting`) */
const BANK_HUB_PATH = '/add-money?method=bank'

export type AddMoneyMethodRow = { title: string; description: string; icon: ReactNode }
export type AddMoneyRowMethod = Extract<AddMoneyMethod, 'ars' | 'bank' | 'pix' | 'crypto'>

/** the Add list's rows, shared by the Add picker and the verified page */
export function useAddMoneyMethodRows(): Record<AddMoneyRowMethod, AddMoneyMethodRow> {
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

export const isAddMoneyRowMethod = (method: AddMoneyMethod): method is AddMoneyRowMethod =>
    method === 'ars' || method === 'bank' || method === 'pix' || method === 'crypto'

/**
 * Where a row goes. `returnTo` is where its flow comes back to. The bank hub shares /add-money's path, so it
 * cannot return to the picker: it takes `bankReturnTo`, where the picker itself would return (none: Home).
 */
export function addMoneyMethodHref(method: AddMoneyRowMethod, returnTo: string, bankReturnTo: string | null): string {
    if (method === 'bank') return bankReturnTo ? withReturnTo(BANK_HUB_PATH, bankReturnTo) : BANK_HUB_PATH
    // Pix and ARS have one currency each, so they open the deposit, not a chooser of one row
    const path =
        method === 'crypto'
            ? '/add-money/crypto'
            : method === 'pix'
              ? PIX_ADD_MONEY_PATH
              : rewriteMethodPath(ARS_ADD_MONEY_PATH)
    return withReturnTo(path, returnTo)
}
