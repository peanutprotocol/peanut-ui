import type { CapabilityRoute } from '@/types/capabilities'

export const PIX_METHOD = 'PIX_BR'

export function findPixRoute(
    routes: CapabilityRoute[] | undefined,
    operation: CapabilityRoute['operation']
): CapabilityRoute | undefined {
    return routes?.find((route) => route.operation === operation && route.method === PIX_METHOD)
}

/** What a Pix deposit or withdrawal page shows, from the backend's route: one flow for every provider. */
export type PixScreen = 'loading' | 'paused' | 'flow' | 'unavailable'

/**
 * A paused route shows the outage screen; a refused route, or none, shows "not
 * available" with its reason. Any other route mounts the Pix flow, whichever
 * provider it names: the flow reads the user's step from the route, and the
 * provider's differences from the API's answers.
 */
export function pixScreen(route: CapabilityRoute | undefined, isLoading: boolean): PixScreen {
    if (isLoading) return 'loading'
    if (!route || route.state === 'refused') return 'unavailable'
    if (route.state === 'paused') return 'paused'
    return 'flow'
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

/**
 * Why a Pix payment or a Pix-key send cannot start, from the backend's pay:PIX_BR route: the
 * Brazil pause (`paused`), or a residence the route does not serve yet (`residence`). Null when
 * the route lets it through, or the API sent no pay route; the payment's own gates then decide.
 */
export type PixPayBlock = 'paused' | 'residence'

export function pixPayBlock(route: CapabilityRoute | undefined): PixPayBlock | null {
    if (route?.state === 'paused') return 'paused'
    if (route?.state === 'refused' && route.reason?.code === 'residence_not_served') return 'residence'
    return null
}
