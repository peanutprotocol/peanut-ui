import { isConfirmedBadgeCampaignClaim, settlePendingBadgeCampaigns, type BadgeCampaignClaim } from './badge-campaigns'
import {
    acquisitionDestinationRoute,
    parseAcquisitionNavigation,
    type AcquisitionNavigation,
} from './acquisition-navigation'

export type LegacyInviteAcquisition = AcquisitionNavigation & {
    campaignTag: string
}

/**
 * Compatibility adapter for already-published legacy invite links. The backend
 * owns the opaque campaign identity and destination enum; this client never
 * infers either from the invite code or from badge provenance.
 */
export function parseLegacyInviteAcquisition(value: unknown): LegacyInviteAcquisition | undefined {
    if (!value || typeof value !== 'object') return undefined
    const candidate = value as { campaignTag?: unknown }
    const navigation = parseAcquisitionNavigation(value)
    if (typeof candidate.campaignTag !== 'string' || candidate.campaignTag.trim().length === 0 || !navigation)
        return undefined
    return {
        campaignTag: candidate.campaignTag.trim(),
        ...navigation,
    }
}

/**
 * A bespoke compatibility destination is usable only after the matching badge
 * claim is confirmed. Every other outcome follows the descriptor's safe fallback.
 */
export function destinationForInviteAcquisition(
    acquisition: LegacyInviteAcquisition,
    claims: readonly BadgeCampaignClaim[]
): string {
    const matchingClaim = claims.find(
        (claim) => claim.badgeCampaign.toLowerCase() === acquisition.campaignTag.toLowerCase()
    )
    return acquisitionDestinationRoute(
        matchingClaim && isConfirmedBadgeCampaignClaim(matchingClaim) ? acquisition.destination : acquisition.fallback
    )
}

/** Consume the claim batch returned by signed-out registration's invite accept. */
export function settleAcceptedInviteAcquisition(
    acquisition: LegacyInviteAcquisition,
    claims: readonly BadgeCampaignClaim[]
): { destination: string; pending: string[] } {
    return {
        destination: destinationForInviteAcquisition(acquisition, claims),
        pending: settlePendingBadgeCampaigns([acquisition.campaignTag], claims),
    }
}
