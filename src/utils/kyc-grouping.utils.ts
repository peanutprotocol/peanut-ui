import { type IUserProfile } from '@/interfaces/interfaces'
import { type KycHistoryEntry } from '@/components/Kyc/KycStatusItem'

/**
 * Builds the single identity-verification timeline entry for the activity feed.
 *
 * Provider-agnostic: the user does ONE identity check, so there is one row. Its
 * status is read from useIdentityVerification() inside KycStatusItem — this only
 * decides whether to show the row (status !== 'not_started') and where it sorts.
 * Replaces the per-region split (groupKycByRegion), which derived rows from raw
 * provider KYC fields that the FE no longer reads.
 */
export function buildKycHistoryEntry(profile: IUserProfile): KycHistoryEntry | null {
    const identity = profile.identityVerification
    if (!identity || identity.status === 'not_started') return null

    const timestamp = identity.reviewedAt ?? identity.submittedAt ?? profile.user.createdAt ?? new Date().toISOString()

    return {
        isKyc: true,
        uuid: 'identity-verification',
        timestamp,
    }
}
