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

/**
 * Which line explains a refused route: a localized one for each reason this
 * build knows (api `routing/rank.ts`), else the route's own reason text
 * (`reason`, display-ready from the API). Only an outage says "try again":
 * residence, rollout and an unserved method do not change by waiting.
 */
export type PixRefusalCopy = 'rejected' | 'setup-failed' | 'residence' | 'not-yet' | 'down' | 'not-served' | 'reason'

const REFUSAL_COPY: Record<string, PixRefusalCopy> = {
    residence_not_served: 'residence',
    rollout_closed: 'not-yet',
    provider_unavailable: 'down',
    provider_paused: 'down',
    method_not_served: 'not-served',
    provider_rejected: 'rejected',
    provider_setup_failed: 'setup-failed',
}

export function pixRefusalCopy(reason: CapabilityRoute['reason']): PixRefusalCopy {
    // no route at all: the API offers no Pix to this user
    if (!reason) return 'not-served'
    return REFUSAL_COPY[reason.code] ?? (reason.userMessage ? 'reason' : 'not-served')
}
