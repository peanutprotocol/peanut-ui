'use client'

import { useTranslations } from 'next-intl'
import { useCallback, useMemo } from 'react'
import { formatCurrencyAmount } from '@/utils/currency'
import { claimErrorKey } from './claimErrors'
import type { RailLabels } from './instructionRows'
import { depositRuleLines, type DepositRuleKey } from './ruleLines'
import type { DepositCorridor, DepositRail, DepositRowLabels, DepositRules, DepositSenderTerms } from './types'

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
    BANK_TRANSFER_BR: 'corridors.BANK_TRANSFER_BR.railName',
    BANK_TRANSFER_CO: 'corridors.BANK_TRANSFER_CO.railName',
    PIX_BR: 'corridors.PIX_BR.railName',
    BANK_TRANSFER_AR: 'corridors.BANK_TRANSFER_AR.railName',
} as const satisfies Record<DepositCorridor, string>

const ARRIVAL_KEYS = {
    SEPA_EU: 'corridors.SEPA_EU.arrival',
    FASTER_PAYMENTS_GB: 'corridors.FASTER_PAYMENTS_GB.arrival',
    ACH_US: 'corridors.ACH_US.arrival',
    SPEI_MX: 'corridors.SPEI_MX.arrival',
    BANK_TRANSFER_BR: 'corridors.BANK_TRANSFER_BR.arrival',
    BANK_TRANSFER_CO: 'corridors.BANK_TRANSFER_CO.arrival',
    PIX_BR: 'corridors.PIX_BR.arrival',
    BANK_TRANSFER_AR: 'corridors.BANK_TRANSFER_AR.arrival',
} as const satisfies Record<DepositCorridor, string>

const ARRIVAL_DETAIL_KEYS = {
    SEPA_EU: 'corridors.SEPA_EU.arrivalDetail',
    FASTER_PAYMENTS_GB: 'corridors.FASTER_PAYMENTS_GB.arrivalDetail',
    ACH_US: 'corridors.ACH_US.arrivalDetail',
    SPEI_MX: 'corridors.SPEI_MX.arrivalDetail',
    BANK_TRANSFER_BR: 'corridors.BANK_TRANSFER_BR.arrivalDetail',
    BANK_TRANSFER_CO: 'corridors.BANK_TRANSFER_CO.arrivalDetail',
    PIX_BR: 'corridors.PIX_BR.arrivalDetail',
    BANK_TRANSFER_AR: 'corridors.BANK_TRANSFER_AR.arrivalDetail',
} as const satisfies Record<DepositCorridor, string>

/** only the corridors a provider opens for residents alone carry these */
const RESIDENCE_KEYS = {
    BANK_TRANSFER_BR: 'corridors.BANK_TRANSFER_BR',
    BANK_TRANSFER_CO: 'corridors.BANK_TRANSFER_CO',
    BANK_TRANSFER_AR: 'corridors.BANK_TRANSFER_AR',
} as const

/**
 * The corridors whose country takes QR payments. Only Brazil is left: Colombia
 * has the residence rule and no QR flow, and Argentina no longer has a screen
 * of its own to say it on.
 */
const QR_PAY_KEYS = {
    BANK_TRANSFER_BR: 'corridors.BANK_TRANSFER_BR.qrPay',
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

    /**
     * Why a claim failed, in the user's language. The backend answers in
     * English whatever the locale, so the code decides the sentence and the
     * backend's own message never reaches a screen.
     */
    const claimErrorBody = (code: string | undefined, status: number | undefined) =>
        t(`errors.${claimErrorKey(code, status)}`)

    /**
     * What the corridor costs, and where the rate behind it can be read.
     *
     * One sentence for every corridor, because the answer is the same one:
     * Peanut charges nothing and the money arrives as USD. Only a corridor
     * that actually converts links to the rate — a dollar account converts
     * nothing, so a rate page would answer a question it never asked.
     */
    const feeLine = (rail: DepositRail): { text: string; ratesFor?: string } => {
        if (rail.currency === 'USD') return { text: t('fees.noFee') }
        return { text: t('fees.converted'), ratesFor: rail.currency }
    }

    const railName = (corridor: DepositCorridor) => t(RAIL_NAME_KEYS[corridor])
    const arrival = (corridor: DepositCorridor) => t(ARRIVAL_KEYS[corridor])
    const arrivalDetail = (corridor: DepositCorridor) => t(ARRIVAL_DETAIL_KEYS[corridor])
    /**
     * What a residence-gated corridor says: `caveat` in the row body, so the
     * rule is read before the tap, and `requirement` on the screen that
     * explains the tap that did not open an account.
     */
    const residenceLine = (corridor: DepositCorridor): { caveat: string; requirement: string } | undefined => {
        const key = RESIDENCE_KEYS[corridor as keyof typeof RESIDENCE_KEYS]
        return key ? { caveat: t(`${key}.residenceOnly`), requirement: t(`${key}.residenceRequired`) } : undefined
    }

    /**
     * What a non-resident can still do there: pay a QR code from their
     * balance. Only the rails whose country takes them say it — Colombia has
     * no QR payment flow, so its explainer offers nothing it cannot do.
     */
    const qrPayLine = (rail: DepositRail): string | undefined => {
        const key = QR_PAY_KEYS[rail.corridor as keyof typeof QR_PAY_KEYS]
        return rail.qrPay && key ? t(key) : undefined
    }

    return {
        t,
        rowLabels,
        railLabels,
        ruleLines,
        railName,
        arrival,
        arrivalDetail,
        residenceLine,
        qrPayLine,
        claimErrorBody,
        feeLine,
    }
}
