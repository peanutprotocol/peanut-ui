'use client'

import type { MantecaLimit } from '@/interfaces'
import { SYMBOLS_BY_CURRENCY_CODE } from '@/hooks/useCurrency'
import { getCurrencyFlagUrl } from '@/constants/countryCurrencyMapping'
import { formatExtendedNumber } from '@/utils/general.utils'
import type { LimitValidationResult, LimitFlowType } from './hooks/useLimitsValidation'
import type { IconName } from '@/components/Global/Icons/Icon'

// limits period type, used in tabs for limits page
export type LimitsPeriod = 'monthly' | 'yearly'

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
    BLOCKING_TITLE: 'This amount exceeds your limit.',
    WARNING_TITLE: "You're close to your limit.",
    CHECK_LIMITS: 'Check my limits.',
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
 * uses centralized SYMBOLS_BY_CURRENCY_CODE from useCurrency
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
        return type === 'bg' ? 'bg-success-3' : 'text-success-1'
    }
    if (remainingPercent > LIMIT_WARNING_THRESHOLD) {
        return type === 'bg' ? 'bg-yellow-1' : 'text-yellow-1'
    }
    return type === 'bg' ? 'bg-error-4' : 'text-error-4'
}

// limits warning card helper - eliminates DRY violations
// generates props for LimitsWarningCard based on validation result

export interface LimitsWarningItem {
    text: string
    isLink?: boolean
    href?: string
    icon?: IconName
}

interface LimitsWarningCardPropsResult {
    type: 'warning' | 'error'
    title: string
    items: LimitsWarningItem[]
    showSupportLink: boolean
}

interface GetLimitsWarningCardPropsOptions {
    validation: LimitValidationResult & { isMantecaUser?: boolean }
    flowType: LimitFlowType
    currency: string
}

/**
 * generates LimitsWarningCard props from validation result
 * centralizes the logic that was duplicated across 4+ files
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
    const currencySymbol = getCurrencySymbol(currency)
    const formattedLimit = formatExtendedNumber(validation.remainingLimit ?? 0)

    // build the limit message based on flow type
    let limitMessage = ''
    if (flowType === 'onramp') {
        limitMessage = `You can add up to ${currencySymbol === '$' ? '' : currencySymbol + ' '}${currencySymbol === '$' ? '$' : ''}${formattedLimit}${validation.daysUntilReset ? '' : ' per transaction'}`
    } else if (flowType === 'offramp') {
        limitMessage = `You can withdraw up to ${currencySymbol === '$' ? '' : currencySymbol + ' '}${currencySymbol === '$' ? '$' : ''}${formattedLimit}${validation.daysUntilReset ? '' : ' per transaction'}`
    } else {
        // qr-payment
        limitMessage = `You can pay up to ${currencySymbol === '$' ? '' : currencySymbol + ' '}${currencySymbol === '$' ? '$' : ''}${formattedLimit} per transaction`
    }

    items.push({ text: limitMessage })

    // add days until reset if applicable
    if (validation.daysUntilReset) {
        items.push({ text: `Limit resets in ${validation.daysUntilReset} days.` })
    }

    // add check limits link
    items.push({
        text: LIMITS_COPY.CHECK_LIMITS,
        isLink: true,
        href: '/limits',
        icon: 'external-link',
    })

    return {
        type: validation.isBlocking ? 'error' : 'warning',
        title: validation.isBlocking ? LIMITS_COPY.BLOCKING_TITLE : LIMITS_COPY.WARNING_TITLE,
        items,
        showSupportLink: validation.isMantecaUser ?? false,
    }
}
