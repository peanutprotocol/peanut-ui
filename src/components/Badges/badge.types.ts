import type { StaticImageData } from 'next/image'
import type { User } from '@/interfaces/interfaces'
import type { BadgeCatalogEntry, BadgeUnlockRequirement } from '@/services/badges'

export type BadgeHistoryEntry = {
    isBadge: true
    uuid: string
    timestamp: string
    code: string
    iconUrl?: string | null
}

export const isBadgeHistoryItem = (entry: unknown): entry is BadgeHistoryEntry =>
    typeof entry === 'object' && entry !== null && !!(entry as { isBadge?: unknown }).isBadge

export type OwnedBadge = NonNullable<User['badges']>[number]

export type BadgeCollectionEntry = {
    code: string
    iconUrl: string | null
    earned: boolean
    earnedAt?: string | Date
    unlock?: BadgeUnlockRequirement
}

/** A collection entry with its localized copy and resolved artwork. */
export type BadgeView = BadgeCollectionEntry & {
    name: string
    description: string
    logo?: string | StaticImageData
}

/** Earned badges lead (newest first); the remaining achievable catalog follows
 * in canonical API order. Held retired badges remain visible. */
export function buildBadgeCollection(
    ownedBadges: readonly OwnedBadge[],
    catalog: readonly Pick<BadgeCatalogEntry, 'code' | 'iconUrl' | 'unlock'>[]
): BadgeCollectionEntry[] {
    const owned = [...ownedBadges].sort((a, b) => {
        const aTime = new Date(a.earnedAt).getTime()
        const bTime = new Date(b.earnedAt).getTime()
        return (Number.isNaN(bTime) ? 0 : bTime) - (Number.isNaN(aTime) ? 0 : aTime)
    })
    const catalogByCode = new Map(catalog.map((badge) => [badge.code, badge]))
    const held = new Set(owned.map((badge) => badge.code))

    return [
        ...owned.map((badge) => {
            const definition = catalogByCode.get(badge.code)
            return {
                code: badge.code,
                iconUrl: badge.iconUrl || definition?.iconUrl || null,
                earned: true,
                earnedAt: badge.earnedAt,
                unlock: definition?.unlock,
            }
        }),
        ...catalog
            .filter((badge) => !held.has(badge.code))
            .map((badge) => ({
                code: badge.code,
                iconUrl: badge.iconUrl,
                earned: false,
                unlock: badge.unlock,
            })),
    ]
}
