import { compareStoreVersions, normalizeStoreVersion, type StoreUpdateOffer } from '@/utils/store-update'
import { parseAppUpdateCutoffs } from '@/features/kill-switches/kill-switches.utils'

export interface StoreUpdatePrompt {
    tier: 1 | 4
    version: string
    platform: 'ios' | 'android'
}

export function getStoreUpdatePrompt(offer: StoreUpdateOffer | null, rawCutoffs: unknown): StoreUpdatePrompt | null {
    const cutoffs = parseAppUpdateCutoffs(rawCutoffs)
    if (!cutoffs || !offer || (offer.platform !== 'ios' && offer.platform !== 'android')) return null
    const { platform, installedVersion, availableVersion } = offer
    const installed = normalizeStoreVersion(platform, installedVersion)
    const available = normalizeStoreVersion(platform, availableVersion)
    if (!installed || !available || (compareStoreVersions(platform, available, installed) ?? 0) <= 0) return null

    const cutoff = normalizeStoreVersion(platform, cutoffs[platform])
    if (
        cutoff &&
        (compareStoreVersions(platform, installed, cutoff) ?? 0) < 0 &&
        (compareStoreVersions(platform, available, cutoff) ?? -1) >= 0
    ) {
        return { tier: 1, version: `${platform}:${cutoff}`, platform }
    }
    return { tier: 4, version: `${platform}:${available}`, platform }
}
