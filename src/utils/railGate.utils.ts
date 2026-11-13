import { type IUserRail } from '@/interfaces/interfaces'

// Pure helpers for reading gate state off the user's rails. Phase 6 of
// rail-gating: the frontend gate hooks derive from UserRail.status instead
// of kycVerifications / bridgeKycStatus. Mirrors the backend resolveEnabledRail.

export type RailProviderCode = 'MANTECA' | 'BRIDGE'

const IN_PROGRESS_STATUSES: ReadonlyArray<string> = ['PENDING', 'REQUIRES_INFORMATION', 'REQUIRES_EXTRA_INFORMATION']

function railsForProvider(rails: IUserRail[] | undefined, provider: RailProviderCode): IUserRail[] {
    return (rails ?? []).filter((r) => r.rail.provider.code === provider)
}

/** True when the user holds an ENABLED rail for the provider. */
export function hasEnabledRail(rails: IUserRail[] | undefined, provider: RailProviderCode): boolean {
    return railsForProvider(rails, provider).some((r) => r.status === 'ENABLED')
}

/**
 * True when the user holds a *full-tier* ENABLED Manteca rail — one that
 * carries a mantecaUserId. QR-tier rails (enabled on Sumsub approval, no id)
 * do not count: deposit / withdraw need real per-user Manteca KYC. `country`
 * (ISO-2) optionally narrows to a specific rail method country.
 */
export function hasFullMantecaRail(rails: IUserRail[] | undefined, country?: string): boolean {
    const c = country?.toUpperCase()
    return railsForProvider(rails, 'MANTECA').some((r) => {
        if (r.status !== 'ENABLED') return false
        if (c && r.rail.method.country.toUpperCase() !== c) return false
        // metadata.mantecaUserId comes from a Prisma Json column — it may
        // arrive as a string (current backend) or a number (older rows or
        // any path that stores the raw provider id). Coerce both to a
        // non-empty string before deciding the rail is gateable, so a number
        // doesn't silently fail this check and lock the user out of QR/withdraw.
        const id = r.metadata?.mantecaUserId
        const idStr = id == null ? '' : String(id)
        return idStr.length > 0
    })
}

/** True when any rail for the provider is mid-review (pending / requires info). */
export function hasRailInProgress(rails: IUserRail[] | undefined, provider: RailProviderCode): boolean {
    return railsForProvider(rails, provider).some((r) => IN_PROGRESS_STATUSES.includes(r.status))
}

/** True when the provider has at least one rail in a functional or in-progress state. */
export function hasFunctionalRail(rails: IUserRail[] | undefined, provider: RailProviderCode): boolean {
    return railsForProvider(rails, provider).some(
        (r) => r.status === 'ENABLED' || IN_PROGRESS_STATUSES.includes(r.status)
    )
}
