'use client'

import { useTranslations } from 'next-intl'
import { useMemo } from 'react'
import type { DepositCorridor, DepositRowLabels } from './types'

/**
 * Catalog keys per corridor, written out rather than built by template so the
 * typed catalog checks them: a corridor added without its copy fails the
 * build instead of rendering a raw key.
 */
const RAIL_NAME_KEYS = {
    SEPA_EU: 'corridors.SEPA_EU.railName',
    FASTER_PAYMENTS_GB: 'corridors.FASTER_PAYMENTS_GB.railName',
    ACH_US: 'corridors.ACH_US.railName',
    SPEI_MX: 'corridors.SPEI_MX.railName',
    PIX_BR: 'corridors.PIX_BR.railName',
    BANK_TRANSFER_AR: 'corridors.BANK_TRANSFER_AR.railName',
} as const satisfies Record<DepositCorridor, string>

const ARRIVAL_KEYS = {
    SEPA_EU: 'corridors.SEPA_EU.arrival',
    FASTER_PAYMENTS_GB: 'corridors.FASTER_PAYMENTS_GB.arrival',
    ACH_US: 'corridors.ACH_US.arrival',
    SPEI_MX: 'corridors.SPEI_MX.arrival',
    PIX_BR: 'corridors.PIX_BR.arrival',
    BANK_TRANSFER_AR: 'corridors.BANK_TRANSFER_AR.arrival',
} as const satisfies Record<DepositCorridor, string>

const ARRIVAL_DETAIL_KEYS = {
    SEPA_EU: 'corridors.SEPA_EU.arrivalDetail',
    FASTER_PAYMENTS_GB: 'corridors.FASTER_PAYMENTS_GB.arrivalDetail',
    ACH_US: 'corridors.ACH_US.arrivalDetail',
    SPEI_MX: 'corridors.SPEI_MX.arrivalDetail',
    PIX_BR: 'corridors.PIX_BR.arrivalDetail',
    BANK_TRANSFER_AR: 'corridors.BANK_TRANSFER_AR.arrivalDetail',
} as const satisfies Record<DepositCorridor, string>

/** only the corridors that cannot be held as an account have a reason */
const UNCLAIMABLE_KEYS = {
    PIX_BR: 'corridors.PIX_BR.unclaimable',
    BANK_TRANSFER_AR: 'corridors.BANK_TRANSFER_AR.unclaimable',
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
            beneficiaryAddress: t('rows.beneficiaryAddress'),
            paymentReference: t('rows.paymentReference'),
            accepts: t('rows.accepts'),
        }),
        [t]
    )

    const railName = (corridor: DepositCorridor) => t(RAIL_NAME_KEYS[corridor])
    const arrival = (corridor: DepositCorridor) => t(ARRIVAL_KEYS[corridor])
    const arrivalDetail = (corridor: DepositCorridor) => t(ARRIVAL_DETAIL_KEYS[corridor])
    const unclaimableReason = (corridor: DepositCorridor) => {
        const key = UNCLAIMABLE_KEYS[corridor as keyof typeof UNCLAIMABLE_KEYS]
        return key ? t(key) : undefined
    }

    return { t, rowLabels, railName, arrival, arrivalDetail, unclaimableReason }
}
