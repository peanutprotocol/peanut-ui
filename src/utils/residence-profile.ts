import type { IUserProfile, ResidenceProfile } from '@/interfaces/interfaces'

/** Only the transport adapter knows the old fields, for API rollout and old fixtures. */
export interface LegacyResidence {
    verified?: string | null
    declared?: string | null
    declaredSecond?: string | null
    pending?: string | null
    pendingSecond?: string | null
    pendingStatus?: string | null
    pendingRequestedAt?: string | null
}
export type UserProfileWire = Omit<IUserProfile, 'residence'> & { residence?: ResidenceProfile | LegacyResidence }

export function normalizeResidence(
    value: ResidenceProfile | LegacyResidence | undefined
): ResidenceProfile | undefined {
    if (!value) return undefined
    if (
        'secondaryDeclaredCountry' in value ||
        (value.verified && typeof value.verified === 'object') ||
        (value.declared && typeof value.declared === 'object')
    )
        return value as ResidenceProfile
    const legacy = value as LegacyResidence
    const verified = legacy.verified?.trim() || null
    const declared = legacy.pending?.trim() || legacy.declared?.trim() || null
    const pendingStatus = legacy.pendingStatus
    const status =
        pendingStatus === 'COLLECTING' ||
        pendingStatus === 'REVIEW_PENDING' ||
        pendingStatus === 'REJECTED' ||
        pendingStatus === 'BLOCKED'
            ? pendingStatus
            : 'UNVERIFIED'
    return {
        verified: verified
            ? {
                  country: verified,
                  status: legacy.pending && !['REJECTED', 'BLOCKED'].includes(status) ? 'CHANGE_REQUESTED' : 'VERIFIED',
                  updatedAt: null,
              }
            : null,
        declared:
            declared && (declared !== verified || legacy.pending)
                ? {
                      country: declared,
                      status,
                      updatedAt: legacy.pendingRequestedAt ?? null,
                      secondCountry: legacy.pending ? (legacy.pendingSecond ?? null) : (legacy.declaredSecond ?? null),
                  }
                : null,
        ...(legacy.declaredSecond !== undefined && { secondaryDeclaredCountry: legacy.declaredSecond }),
    }
}

export function normalizeUserProfile(value: UserProfileWire): IUserProfile {
    return { ...value, residence: normalizeResidence(value.residence) }
}

export function pendingResidenceCountry(residence: ResidenceProfile | null | undefined): string | null {
    return residence?.verified?.status === 'CHANGE_REQUESTED' ? (residence.declared?.country ?? null) : null
}
