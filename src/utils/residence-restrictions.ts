import type { ResidenceRestrictionSets } from '@/hooks/useResidenceRestrictionSets'

export const deriveResidenceRestrictionsFrom = (
    sets: ResidenceRestrictionSets,
    iso2: string | null | undefined,
    bankCustomer = false
): { banking: boolean; card: boolean } => {
    const code = iso2?.toUpperCase().trim()
    if (!code) return { banking: false, card: false }
    const newCustomersOnly = sets.bankingNewCustomersOnly.has(code)
    const keepsBank = bankCustomer && newCustomersOnly
    return {
        banking: !keepsBank && (sets.full.has(code) || sets.bankingOnly.has(code) || newCustomersOnly),
        card: sets.full.has(code) || sets.cardOnly.has(code),
    }
}

export const isQrResidenceRestricted = (sets: ResidenceRestrictionSets, country: string): boolean =>
    // Russia accepts identity documents but still closes residence-based pool access.
    sets.refusedIdIssuers.has(country) || country === 'RU'
