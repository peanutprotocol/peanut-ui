import type { CapabilityRoute } from '@/types/capabilities'

export const PIX_METHOD = 'PIX_BR'

export function findPixRoute(
    routes: CapabilityRoute[] | undefined,
    operation: CapabilityRoute['operation']
): CapabilityRoute | undefined {
    return routes?.find((route) => route.operation === operation && route.method === PIX_METHOD)
}

/** Whose screens a Pix deposit or withdrawal mounts, from the backend's route. */
export type PixScreen = 'loading' | 'paused' | 'avenia' | 'manteca' | 'unavailable'

/**
 * The route names the provider. A paused route shows the provider-outage
 * screen; a refused route shows "not available" with its reason, never another
 * provider's screens.
 */
export function pixScreen(route: CapabilityRoute | undefined, isLoading: boolean): PixScreen {
    if (isLoading) return 'loading'
    if (!route || route.state === 'refused') return 'unavailable'
    if (route.state === 'paused') return 'paused'
    if (route.provider === 'avenia') return 'avenia'
    if (route.provider === 'manteca') return 'manteca'
    return 'unavailable'
}

/** Route reasons that mean Pix is not offered to this user (api `routing/rank.ts`), not a fault of theirs. */
const NOT_OFFERED_REASONS = [
    'residence_not_served',
    'rollout_closed',
    'provider_unavailable',
    'provider_paused',
    'method_not_served',
]

/**
 * Which line explains a refused route: a localized one for the reasons this build
 * knows, else the route's own reason text (`reason`, display-ready from the API).
 */
export type PixRefusalCopy = 'rejected' | 'setup-failed' | 'not-offered' | 'reason'

export function pixRefusalCopy(reason: CapabilityRoute['reason']): PixRefusalCopy {
    if (!reason || NOT_OFFERED_REASONS.includes(reason.code)) return 'not-offered'
    if (reason.code === 'provider_rejected') return 'rejected'
    if (reason.code === 'provider_setup_failed') return 'setup-failed'
    return reason.userMessage ? 'reason' : 'not-offered'
}
