import type { MantecaLimit } from '@/interfaces'
import { BRIDGE_REGIONS, MANTECA_REGIONS, REGION_TO_BRIDGE_PARAM, type LimitsPeriod } from '../consts'

/**
 * determines which provider route to navigate to based on region path
 * includes region query param for bridge limits page
 */
export function getProviderRoute(regionPath: string, hasMantecaKyc: boolean): string {
    // latam region always goes to manteca if user has manteca kyc
    if (MANTECA_REGIONS.includes(regionPath) && hasMantecaKyc) {
        return '/limits/manteca'
    }
    // bridge regions go to bridge with region param
    if (BRIDGE_REGIONS.includes(regionPath)) {
        const regionParam = REGION_TO_BRIDGE_PARAM[regionPath] || 'us'
        return `/limits/bridge?region=${regionParam}`
    }
    // default to bridge for any other unlocked region
    return '/limits/bridge?region=us'
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

// thresholds for limit usage coloring
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
