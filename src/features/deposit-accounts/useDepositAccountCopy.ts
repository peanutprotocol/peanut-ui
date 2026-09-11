'use client'

import { useTranslations } from 'next-intl'
import { useMemo } from 'react'
import type { DepositCorridor, DepositRowLabels } from './types'

/**
 * Catalog keys per corridor, written out rather than built by template so the
 * typed catalog checks them: a corridor added without its copy fails the
 * build instead of rendering a raw key.
 */
const ARRIVAL_KEYS = {
    EUR_SEPA: 'corridors.EUR_SEPA.arrival',
    GBP_FPS: 'corridors.GBP_FPS.arrival',
    USD_ACH: 'corridors.USD_ACH.arrival',
    MXN_SPEI: 'corridors.MXN_SPEI.arrival',
    BRL_PIX: 'corridors.BRL_PIX.arrival',
    ARS_TRANSFER: 'corridors.ARS_TRANSFER.arrival',
} as const satisfies Record<DepositCorridor, string>

const ARRIVAL_DETAIL_KEYS = {
    EUR_SEPA: 'corridors.EUR_SEPA.arrivalDetail',
    GBP_FPS: 'corridors.GBP_FPS.arrivalDetail',
    USD_ACH: 'corridors.USD_ACH.arrivalDetail',
    MXN_SPEI: 'corridors.MXN_SPEI.arrivalDetail',
    BRL_PIX: 'corridors.BRL_PIX.arrivalDetail',
    ARS_TRANSFER: 'corridors.ARS_TRANSFER.arrivalDetail',
} as const satisfies Record<DepositCorridor, string>

/** only the corridors that cannot be held as an account have a reason */
const UNCLAIMABLE_KEYS = {
    BRL_PIX: 'corridors.BRL_PIX.unclaimable',
    ARS_TRANSFER: 'corridors.ARS_TRANSFER.unclaimable',
} as const

/**
 * Copy for the deposit-account screens, in one place.
 *
 * Row labels are needed by the cards AND by the share text, so they are
 * resolved once here rather than per screen: what a user reads and what they
 * paste to a payer can then never disagree.
 */
export function useDepositAccountCopy() {
    const t = useTranslations('depositAccounts')

    const rowLabels: DepositRowLabels = useMemo(
        () => ({
            accountHolder: t('rows.accountHolder'),
            taxId: t('rows.taxId'),
            bank: t('rows.bank'),
            iban: t('rows.iban'),
            bic: t('rows.bic'),
            sortCode: t('rows.sortCode'),
            accountNumber: t('rows.accountNumber'),
            routingNumber: t('rows.routingNumber'),
            clabe: t('rows.clabe'),
            cvu: t('rows.cvu'),
            alias: t('rows.alias'),
            bankAddress: t('rows.bankAddress'),
            paymentReference: t('rows.paymentReference'),
            accepts: t('rows.accepts'),
        }),
        [t]
    )

    const arrival = (corridor: DepositCorridor) => t(ARRIVAL_KEYS[corridor])
    const arrivalDetail = (corridor: DepositCorridor) => t(ARRIVAL_DETAIL_KEYS[corridor])
    const unclaimableReason = (corridor: DepositCorridor) => {
        const key = UNCLAIMABLE_KEYS[corridor as keyof typeof UNCLAIMABLE_KEYS]
        return key ? t(key) : undefined
    }

    return { t, rowLabels, arrival, arrivalDetail, unclaimableReason }
}
