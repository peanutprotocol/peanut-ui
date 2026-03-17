import { type User, type BridgeKycStatus } from '@/interfaces'
import { type KycHistoryEntry } from '@/components/Kyc/KycStatusItem'

export type KycRegion = 'STANDARD' | 'LATAM'

export interface RegionKycEntry extends KycHistoryEntry {
    region: KycRegion
}

/**
 * groups kyc data into one activity entry per region.
 * STANDARD = bridgeKycStatus + sumsub verifications with regionIntent STANDARD
 * LATAM = manteca/sumsub verifications with regionIntent LATAM
 */
export function groupKycByRegion(user: User): RegionKycEntry[] {
    const entries: RegionKycEntry[] = []
    const verifications = user.kycVerifications ?? []

    // --- STANDARD region ---
    const standardVerification = verifications.find(
        (v) => v.provider === 'SUMSUB' && v.metadata?.regionIntent === 'STANDARD'
    )

    if (standardVerification) {
        entries.push({
            isKyc: true,
            region: 'STANDARD',
            uuid: 'region-STANDARD',
            timestamp:
                standardVerification.approvedAt ?? standardVerification.updatedAt ?? standardVerification.createdAt,
            verification: standardVerification,
            bridgeKycStatus: user.bridgeKycStatus as BridgeKycStatus | undefined,
        })
    } else if (user.bridgeKycStatus && user.bridgeKycStatus !== 'not_started') {
        // legacy: user only has bridgeKycStatus (pre-sumsub migration)
        const bridgeKycTimestamp = (() => {
            if (user.bridgeKycStatus === 'approved') return user.bridgeKycApprovedAt
            if (user.bridgeKycStatus === 'rejected') return user.bridgeKycRejectedAt
            return user.bridgeKycStartedAt
        })()
        entries.push({
            isKyc: true,
            region: 'STANDARD',
            uuid: 'region-STANDARD',
            timestamp: bridgeKycTimestamp ?? user.createdAt ?? new Date().toISOString(),
            bridgeKycStatus: user.bridgeKycStatus as BridgeKycStatus,
        })
    }

    // --- LATAM region ---
    const latamVerifications = verifications.filter(
        (v) => v.metadata?.regionIntent === 'LATAM' || v.provider === 'MANTECA'
    )
    // pick the most recently updated one
    const latamVerification = [...latamVerifications].sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )[0]

    if (latamVerification) {
        entries.push({
            isKyc: true,
            region: 'LATAM',
            uuid: 'region-LATAM',
            timestamp: latamVerification.approvedAt ?? latamVerification.updatedAt ?? latamVerification.createdAt,
            verification: latamVerification,
        })
    }

    return entries
}
