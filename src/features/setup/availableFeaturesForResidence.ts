import type { ResidenceRestrictionSets } from '@/hooks/useResidenceRestrictionSets'
import { residenceAvailability } from '@/utils/residence-availability'

/** Optional features displayed above the two universal account/payment rows. */
export function availableSetupFeaturesForResidence(
    sets: ResidenceRestrictionSets,
    residence: string,
    settled: boolean
) {
    if (!settled || !residence.trim()) return { bank: false, card: false }
    const { available } = residenceAvailability(sets, residence.trim())
    return {
        bank: available.some((item) => item !== 'p2p' && item !== 'card' && item !== 'bank'),
        card: available.includes('card'),
    }
}
