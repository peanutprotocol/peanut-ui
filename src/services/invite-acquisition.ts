import { settlePendingBadgeCampaigns, type BadgeCampaignClaim } from './badge-campaigns'

export type LegacyInviteAcquisition = {
    campaignTag: string
}

/**
 * Compatibility adapter for already-published legacy invite links. The backend
 * owns the opaque campaign identity; this client never infers it from the
 * invite code or from badge provenance. Bespoke destinations retired with
 * TASK-21226 — every acquisition lands in the normal app.
 */
export function parseLegacyInviteAcquisition(value: unknown): LegacyInviteAcquisition | undefined {
    if (!value || typeof value !== 'object') return undefined
    const candidate = value as { campaignTag?: unknown }
    if (typeof candidate.campaignTag !== 'string' || candidate.campaignTag.trim().length === 0) return undefined
    return { campaignTag: candidate.campaignTag.trim() }
}

/** Consume the claim batch returned by signed-out registration's invite accept. */
export function settleAcceptedInviteAcquisition(
    acquisition: LegacyInviteAcquisition,
    claims: readonly BadgeCampaignClaim[]
): { destination: string; pending: string[] } {
    return {
        destination: '/home',
        pending: settlePendingBadgeCampaigns([acquisition.campaignTag], claims),
    }
}
