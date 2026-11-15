import TIER_0_BADGE from '@/assets/badges/tier0.svg'
import TIER_1_BADGE from '@/assets/badges/tier1.svg'
import TIER_2_BADGE from '@/assets/badges/tier2.svg'
import TIER_3_BADGE from '@/assets/badges/tier3.svg'
import { type PointsInvite } from '@/services/services.types'

export const getTierBadge = (tier: number) => {
    const badges = [TIER_0_BADGE, TIER_1_BADGE, TIER_2_BADGE, TIER_3_BADGE]
    return badges[tier] || TIER_0_BADGE
}

/**
 * tier progress bar fill percent. tiers >= 2 are maxed; below that the ratio
 * to the next threshold is eased with pow 0.6 so early points feel visible.
 */
export const getTierProgressPercent = (currentTier: number, totalPoints: number, nextTierThreshold: number): number =>
    currentTier >= 2
        ? 100
        : Math.pow(Math.min(1, nextTierThreshold > 0 ? totalPoints / nextTierThreshold : 0), 0.6) * 100

/**
 * The name to show for an invitee. The API already applies their showFullName
 * choice: fullName is their username when they hid their name (TASK-24090).
 * Null for an invitee who never finished signup.
 */
export const inviteeDisplayName = (invite: Pick<PointsInvite, 'fullName' | 'username'>): string | null =>
    invite.fullName || invite.username
