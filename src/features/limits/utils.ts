'use client'

import type { MantecaLimit, MonthlyRoom } from '@/interfaces/interfaces'
import type { CapabilityRoute, ProviderCode, RailOperation } from '@/types/capabilities'
import { findPixRoute, PIX_METHOD } from '@/features/pix/pixRoute.utils'
import { SYMBOLS_BY_CURRENCY_CODE } from '@/constants/currency-symbols.consts'
import { getCurrencyFlagUrl } from '@/constants/countryCurrencyMapping'
import { formatExtendedNumber } from '@/utils/general.utils'
import type { IconName } from '@/components/Global/Icons/Icon'

// limits period type, used in tabs for limits page
export type LimitsPeriod = 'monthly' | 'yearly'

export type LimitFlowType = 'onramp' | 'offramp' | 'qr-payment'

export type LimitValidationResult = {
    isBlocking: boolean
    isWarning: boolean
    remainingLimit: number | null
    totalLimit: number | null
    message: string | null
    daysUntilReset: number | null
    // currency the limit is denominated in (may differ from transaction currency)
    // e.g. foreign qr users have USD limits even when paying in ARS
    limitCurrency: LimitCurrency | null
}

// region routing configuration
// maps region paths to their respective limits page routes
const REGION_ROUTES: Record<string, { provider: 'bridge' | 'manteca'; param?: string }> = {
    // bridge regions
    europe: { provider: 'bridge', param: 'europe' },
    'north-america': { provider: 'bridge', param: 'us' },
    mexico: { provider: 'bridge', param: 'mexico' },
    argentina: { provider: 'bridge', param: 'argentina' },
    brazil: { provider: 'bridge', param: 'brazil' },
    latam: { provider: 'manteca' },
}

// regions that show bank transfer limits (not qr-only)
export const BANK_TRANSFER_REGIONS = ['us', 'mexico', 'europe'] as const
export type BridgeRegion = 'us' | 'mexico' | 'europe' | 'argentina' | 'brazil'

// ux copy constants
export const LIMITS_COPY = {
    BLOCKING_TITLE: 'This amount exceeds the limit',
    WARNING_TITLE: 'Close to the limit',
    CHECK_LIMITS: 'Check limits',
    SUPPORT_MESSAGE: 'Hi, I would like to increase my payment limits.',
} as const

// utility functions - used across the limits feature

/**
 * determines which provider route to navigate to based on region path
 */
export function getProviderRoute(regionPath: string, hasMantecaKyc: boolean): string {
    const route = REGION_ROUTES[regionPath]

    // latam region goes to manteca if user has manteca kyc
    if (regionPath === 'latam' && hasMantecaKyc) {
        return '/limits/manteca'
    }

    if (route) {
        if (route.provider === 'manteca') {
            return '/limits/manteca'
        }
        return `/limits/bridge${route.param ? `?region=${route.param}` : ''}`
    }

    // default fallback
    return '/limits/bridge?region=us'
}

/** The Pix operation a limits check stands for. */
const PIX_OPERATION: Record<LimitFlowType, RailOperation> = {
    onramp: 'deposit',
    offramp: 'withdraw',
    'qr-payment': 'pay',
}

/**
 * Whose limits apply to a BRL operation: the provider the API's PIX_BR route for that operation names
 * (api `routing/route-for.ts`). Null for any other currency, or when the API sent no such route; the
 * caller then keeps the rules it had.
 */
export function brlLimitsProvider(
    routes: CapabilityRoute[] | undefined,
    flowType: LimitFlowType,
    currency: LimitCurrency
): ProviderCode | null {
    if (currency !== 'BRL') return null
    return (findPixRoute(routes, PIX_OPERATION[flowType])?.provider as ProviderCode | undefined) ?? null
}

/** Whether any of the user's Pix routes names Avenia: Manteca's BRL limits then stand for nothing the user does. */
export function aveniaServesBrl(routes: CapabilityRoute[] | undefined): boolean {
    return !!routes?.some((route) => route.method === PIX_METHOD && route.provider === 'avenia')
}

/**
 * A USD amount checked against one direction of a provider's monthly room (API-CONTRACT-M5 §5). The
 * room says only what is left, not the month's total, so the check blocks and never warns. A room
 * whose USD figure is unknown checks nothing: the API's own limit refusal still holds.
 */
export function monthlyRoomValidation(
    room: MonthlyRoom,
    amountUsd: number,
    daysUntilReset: number
): LimitValidationResult {
    const usdLeft = room.blocked ? 0 : room.usdLeft === null ? null : parseFloat(room.usdLeft)
    const base = {
        isWarning: false,
        totalLimit: null,
        daysUntilReset,
        limitCurrency: 'USD' as const,
    }
    if (usdLeft === null || isNaN(usdLeft)) {
        return {
            ...base,
            isBlocking: false,
            remainingLimit: null,
            message: null,
            daysUntilReset: null,
            limitCurrency: null,
        }
    }
    if (room.blocked || amountUsd > usdLeft) {
        return {
            ...base,
            isBlocking: true,
            remainingLimit: usdLeft,
            message: `Amount exceeds your remaining limit of $${formatExtendedNumber(usdLeft)}`,
        }
    }
    return { ...base, isBlocking: false, remainingLimit: usdLeft, message: null }
}

/**
 * maps a currency string to a valid limit currency type
 * defaults to USD for unsupported currencies
 */
export type LimitCurrency = 'ARS' | 'BRL' | 'USD'

export function mapToLimitCurrency(currency?: string): LimitCurrency {
    const upper = currency?.toUpperCase()
    if (upper === 'ARS' || upper === 'BRL') return upper as LimitCurrency
    return 'USD'
}

/**
 * get currency symbol from currency code
 * uses centralized SYMBOLS_BY_CURRENCY_CODE
 */
export function getCurrencySymbol(currency: string): string {
    return SYMBOLS_BY_CURRENCY_CODE[currency.toUpperCase()] || currency.toUpperCase()
}

/**
 * get flag url from currency code
 * uses centralized getCurrencyFlagUrl from countryCurrencyMapping
 */
export function getFlagUrlForCurrency(currency: string): string | null {
    return getCurrencyFlagUrl(currency)
}

/**
 * format amount with currency symbol
 */
export function formatAmountWithCurrency(amount: number, currency: string): string {
    const symbol = getCurrencySymbol(currency)
    // add space for currency codes (length > 1), not for symbols like $ or €
    const separator = symbol.length > 1 && symbol === symbol.toUpperCase() ? ' ' : ''
    return `${symbol}${separator}${formatExtendedNumber(amount)}`
}

/**
 * get limit and remaining values for the selected period
 */
export function getLimitData(limit: MantecaLimit, period: LimitsPeriod) {
    if (period === 'monthly') {
        return {
            limit: parseFloat(limit.monthlyLimit),
            remaining: parseFloat(limit.availableMonthlyLimit),
        }
    }
    return {
        limit: parseFloat(limit.yearlyLimit),
        remaining: parseFloat(limit.availableYearlyLimit),
    }
}

// limit color thresholds
const LIMIT_HEALTHY_THRESHOLD = 70 // >70% remaining = green
const LIMIT_WARNING_THRESHOLD = 20 // 20-70% remaining = yellow, <20% = red

/**
 * get color class for remaining percentage
 * used by both progress bar and text coloring
 */
export function getLimitColorClass(remainingPercent: number, type: 'bg' | 'text'): string {
    if (remainingPercent > LIMIT_HEALTHY_THRESHOLD) {
        // green-800 borrowed as green-on-white text — no foreground-success token exists (flagged)
        return type === 'bg' ? 'bg-background-icon-bubble-green' : 'text-green-800'
    }
    if (remainingPercent > LIMIT_WARNING_THRESHOLD) {
        return type === 'bg' ? 'bg-background-accent-yellow' : 'text-foreground-attention'
    }
    return type === 'bg' ? 'bg-red-200' : 'text-foreground-error'
}

// limits warning card helper - eliminates DRY violations
// generates props for LimitsWarningCard based on validation result

export interface LimitsWarningItem {
    text: string
    isLink?: boolean
    href?: string
    icon?: IconName
    // discriminator + values so LimitsWarningCard can map items to translated
    // copy (this util can't call useTranslations; `text` is the English fallback)
    kind?: 'limit-amount' | 'reset-days' | 'check-limits'
    amount?: string
    days?: number
    flowType?: LimitFlowType
    perTransaction?: boolean
}

export interface LimitsWarningCardPropsResult {
    type: 'attention' | 'error'
    title: string
    titleKind: 'blocking' | 'attention'
    items: LimitsWarningItem[]
    showSupportLink: boolean
}

interface GetLimitsWarningCardPropsOptions {
    validation: LimitValidationResult & { isMantecaUser?: boolean }
    flowType: LimitFlowType
    currency?: string
}

/**
 * generates LimitsWarningCard props from validation result
 * centralizes the logic that was duplicated across 4+ files
 * uses validation.limitCurrency to show correct currency (e.g. USD for foreign qr limits)
 */
export function getLimitsWarningCardProps({
    validation,
    flowType,
    currency,
}: GetLimitsWarningCardPropsOptions): LimitsWarningCardPropsResult | null {
    // no warning needed if not blocking or warning
    if (!validation.isBlocking && !validation.isWarning) {
        return null
    }

    const items: LimitsWarningItem[] = []
    // use limitCurrency from validation (correct currency for the limit) or fallback to transaction currency
    const limitCurrency = validation.limitCurrency ?? currency ?? 'USD'
    const currencySymbol = getCurrencySymbol(limitCurrency)
    // `?? 0` here would state "you can add up to $0" when the remaining limit is
    // merely UNKNOWN — the same unknown-rendered-as-zero shape as the $0 balance
    // bug. Omit the sentence instead of inventing a figure.
    const formattedLimit = validation.remainingLimit == null ? null : formatExtendedNumber(validation.remainingLimit)
    const amountDisplay =
        formattedLimit === null
            ? null
            : currencySymbol === '$'
              ? `$${formattedLimit}`
              : `${currencySymbol} ${formattedLimit}`

    // a limit that resets is a period's room, whatever the flow; any other is a per-transaction cap
    const perTransaction = !validation.daysUntilReset
    const perTransactionSuffix = perTransaction ? ' per transaction' : ''
    let limitMessage = ''
    if (amountDisplay === null) {
        limitMessage = ''
    } else if (flowType === 'onramp') {
        limitMessage = `You can add up to ${amountDisplay}${perTransactionSuffix}`
    } else if (flowType === 'offramp') {
        limitMessage = `You can withdraw up to ${amountDisplay}${perTransactionSuffix}`
    } else {
        limitMessage = `You can pay up to ${amountDisplay}${perTransactionSuffix}`
    }

    // Skip the amount item entirely when the limit is unknown — no "$0" line.
    if (amountDisplay !== null) {
        items.push({ text: limitMessage, kind: 'limit-amount', amount: amountDisplay, flowType, perTransaction })
    }

    // add days until reset if applicable
    if (validation.daysUntilReset) {
        items.push({
            text: `Limit resets in ${validation.daysUntilReset} days.`,
            kind: 'reset-days',
            days: validation.daysUntilReset,
        })
    }

    // add check limits link
    items.push({
        text: LIMITS_COPY.CHECK_LIMITS,
        isLink: true,
        href: '/limits',
        icon: 'external-link',
        kind: 'check-limits',
    })

    return {
        type: validation.isBlocking ? 'error' : 'attention',
        title: validation.isBlocking ? LIMITS_COPY.BLOCKING_TITLE : LIMITS_COPY.WARNING_TITLE,
        titleKind: validation.isBlocking ? 'blocking' : 'attention',
        items,
        showSupportLink: validation.isMantecaUser ?? false,
    }
}

// ─── BR Limit Increase Eligibility ─────────────────────────────────────────

/** monthly limit threshold — Manteca returns BR limits denominated in USDT */
const BR_SELF_INCREASE_MONTHLY_LIMIT_USDT = 1000

/**
 * determines if the user is a Brazilian Manteca user eligible for
 * self-service limit increase (legacy users without document photos).
 * eligible = has BRL limits with monthly limit ≤ 1000 USDT.
 */
export function isBrUserEligibleForLimitIncrease(mantecaLimits: MantecaLimit[] | null): boolean {
    if (!mantecaLimits || mantecaLimits.length === 0) return false

    const brlLimit = mantecaLimits.find((l) => l.asset === 'BRL' && l.exchangeCountry === 'BRA')
    if (!brlLimit) return false

    const monthlyLimit = parseFloat(brlLimit.monthlyLimit)
    return monthlyLimit > 0 && monthlyLimit <= BR_SELF_INCREASE_MONTHLY_LIMIT_USDT
}
