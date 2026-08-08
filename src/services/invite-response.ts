import { parseLegacyInviteAcquisition } from './invite-acquisition'

export type InviteResolutionFlags = {
    attributionResolved: boolean
    onboardingResolved: boolean
}

function hasLegacyAcquisitionDescriptor(value: unknown): boolean {
    return !!parseLegacyInviteAcquisition(value)
}

/**
 * Resolve rollout discriminators without letting partial or explicit-false
 * responses become access. A pre-discriminator 200 may use its historical
 * success signal only when both new fields are completely absent.
 */
export function resolveInviteResolutionFlags(payload: unknown, legacyNoFlagsResolved: boolean): InviteResolutionFlags {
    if (!payload || typeof payload !== 'object') {
        return { attributionResolved: false, onboardingResolved: false }
    }

    const body = payload as { attributionResolved?: unknown; onboardingResolved?: unknown }
    const hasAttribution = Object.hasOwn(body, 'attributionResolved')
    const hasOnboarding = Object.hasOwn(body, 'onboardingResolved')

    if (!hasAttribution && !hasOnboarding) {
        return {
            attributionResolved: legacyNoFlagsResolved,
            onboardingResolved: legacyNoFlagsResolved,
        }
    }

    // Either explicit false wins over every legacy hint. A partial rollout
    // shape (only one discriminator) also fails closed.
    if (body.attributionResolved === false || body.onboardingResolved === false || !hasAttribution || !hasOnboarding) {
        return { attributionResolved: false, onboardingResolved: false }
    }

    const resolved = body.attributionResolved === true && body.onboardingResolved === true
    return { attributionResolved: resolved, onboardingResolved: resolved }
}

/** New APIs use a typed 409 so old clients safely stop at non-2xx. */
export function isTypedCampaignOnlyInviteResponse(payload: unknown): boolean {
    if (!payload || typeof payload !== 'object') return false
    const body = payload as {
        message?: unknown
        attributionResolved?: unknown
        onboardingResolved?: unknown
        legacyAcquisition?: unknown
    }
    return (
        typeof body.message === 'string' &&
        body.attributionResolved === false &&
        body.onboardingResolved === false &&
        hasLegacyAcquisitionDescriptor(body.legacyAcquisition)
    )
}
