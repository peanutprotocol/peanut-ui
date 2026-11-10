import { VERIFY_ACTION } from '@/features/kyc-features/report'
import type { CapabilityRoute, FeatureReport, FeatureReportEntry } from '@/types/capabilities'
import type { GateState } from '@/utils/capability-gate'

export const PIX_METHOD = 'PIX_BR'

export function findPixRoute(
    routes: CapabilityRoute[] | undefined,
    operation: CapabilityRoute['operation']
): CapabilityRoute | undefined {
    return routes?.find((route) => route.operation === operation && route.method === PIX_METHOD)
}

/** The least reais the route's provider takes for the operation (`route.limits`), or null where it states none. */
export function pixMinimumBrl(route: CapabilityRoute | undefined): string | null {
    return route?.limits?.currency === 'BRL' ? route.limits.minAmount : null
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

/**
 * The BRL account as the account screens read it, from the Pix deposit route: Pix comes from the
 * route, whichever provider serves it. A resident of Brazil gets the local feature refused
 * (`local_residence_unsupported`) and Pix from Avenia's route, so the local entry alone would call
 * their Pix closed. A first-use step (terms, the account the first use opens) is the row's own
 * set-up; a pause reads as pending, because it lifts with nothing for the user to do.
 */
export function pixRouteReportEntry(route: CapabilityRoute): FeatureReportEntry {
    const reason = route.reason?.code
    switch (route.state) {
        case 'ready':
            return { state: 'on' }
        case 'action_required':
            return route.action === VERIFY_ACTION
                ? { state: 'action_required', action: VERIFY_ACTION, reason }
                : { state: 'ready', action: route.action, reason }
        case 'pending':
        case 'paused':
            return { state: 'pending', reason }
        case 'refused':
            return { state: 'refused', reason }
    }
}

/** The feature report with the BRL account read from the Pix deposit route, where the API sends one. */
export function withPixRoute(report: FeatureReport, routes: CapabilityRoute[] | undefined): FeatureReport {
    const route = findPixRoute(routes, 'deposit')
    if (!route) return report
    return {
        ...report,
        local: { ...report.local, accounts: { ...report.local.accounts, BRL: pixRouteReportEntry(route) } },
    }
}

/** The Pix corridor's gate from the deposit route, for the screens that gate accounts by corridor. */
export function pixRouteGate(route: CapabilityRoute): GateState {
    const userMessage = route.reason?.userMessage ?? null
    switch (route.state) {
        case 'ready':
            return { kind: 'ready' }
        case 'action_required':
            return route.action === VERIFY_ACTION ? { kind: 'needs-identity' } : { kind: 'needs-enrollment' }
        case 'pending':
        case 'paused':
            return { kind: 'waiting-on-provider', userMessage, reason: route.reason }
        case 'refused':
            return { kind: 'blocked-rejection', userMessage, reason: route.reason }
    }
}
