'use client'

import { useTranslations } from 'next-intl'
import { useCallback, useMemo } from 'react'
import { formatCurrencyAmount } from '@/utils/currency'
import type { RailLabels } from './instructionRows'
import { depositRuleLines, type DepositRuleKey } from './ruleLines'
import type { DepositCorridor, DepositRowLabels, DepositRules, DepositSenderTerms } from './types'

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
 * Every payment rail a corridor can name, written out for the same reason as
 * the corridor keys above: a rail Bridge starts returning without its copy
 * fails the build instead of reaching a user as `transfer_ar`.
 */
const RAIL_LABEL_KEYS = [
    'ach_push',
    'fednow',
    'wire',
    'sepa',
    'faster_payments',
    'spei',
    'pix',
    'bre_b',
    'transfer_ar',
] as const

/** one rule, in the three voices the screens and the shared text need */
export interface ResolvedRuleLine {
    key: DepositRuleKey
    text: string
    payer: string
    why: string
}

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
            bank: t('rows.bank'),
            iban: t('rows.iban'),
            bic: t('rows.bic'),
            sortCode: t('rows.sortCode'),
            accountNumber: t('rows.accountNumber'),
            routingNumber: t('rows.routingNumber'),
            clabe: t('rows.clabe'),
            brCode: t('rows.brCode'),
            breBKey: t('rows.breBKey'),
            bankAddress: t('rows.bankAddress'),
            beneficiaryAddress: t('rows.beneficiaryAddress'),
            accepts: t('rows.accepts'),
        }),
        [t]
    )

    const railLabels: RailLabels = useMemo(() => {
        const labels = { fallback: t('rows.rails.fallback') } as RailLabels
        for (const key of RAIL_LABEL_KEYS) labels[key] = t(`rows.rails.${key}`)
        return labels
    }, [t])

    /**
     * The rules for one account, resolved into the three voices a rule needs:
     * `text` for the holder reading their own screen, `payer` for the text
     * that leaves the app, and `why` for the (i) behind the line.
     *
     * One resolver, so a rule can never be stated on screen and missing from
     * the message a payer actually reads.
     */
    const ruleLines = useCallback(
        (matching: DepositSenderTerms, rules: DepositRules | undefined, user: string): ResolvedRuleLine[] =>
            depositRuleLines(matching, rules, formatCurrencyAmount).map(({ key, values }) => {
                // `user` is only read by the provider-held line; passing it to
                // every string is cheaper than a per-key values table.
                const all = { user, ...values }
                return {
                    key,
                    text: t(`rules.${key}.line`, all),
                    payer: t(`rules.${key}.payer`, all),
                    why: t(`rules.${key}.why`, all),
                }
            }),
        [t]
    )

    const railName = (corridor: DepositCorridor) => t(RAIL_NAME_KEYS[corridor])
    const arrival = (corridor: DepositCorridor) => t(ARRIVAL_KEYS[corridor])
    const arrivalDetail = (corridor: DepositCorridor) => t(ARRIVAL_DETAIL_KEYS[corridor])
    /**
     * Why a corridor is never a standing account, in both voices: `text` for
     * the row body and the empty state, `why` for the (i) behind it — the
     * exchange-binding and US-nationality rule (`product/providers/fiat/
     * eligibility.md`) that the short sentence has no room for.
     */
    const unclaimableReason = (corridor: DepositCorridor): { text: string; why: string } | undefined => {
        const key = UNCLAIMABLE_KEYS[corridor as keyof typeof UNCLAIMABLE_KEYS]
        return key ? { text: t(`${key}.line`), why: t(`${key}.why`) } : undefined
    }

    return { t, rowLabels, railLabels, ruleLines, railName, arrival, arrivalDetail, unclaimableReason }
}
