import type { MantecaLimit } from '@/interfaces'
import { BRIDGE_REGIONS, MANTECA_REGIONS, REGION_TO_BRIDGE_PARAM, type LimitsPeriod } from './consts.limits'

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
