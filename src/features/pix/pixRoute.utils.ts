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
 * Whether the user's Pix route is open: the API sent it and did not refuse it, paused included.
 * Home's Add drawer reads the narrower `pixDepositOffered`.
 */
export function pixRouteOpen(route: Pick<CapabilityRoute, 'state'> | undefined): boolean {
    return !!route && route.state !== 'refused'
}

/**
 * Whether the route reads the Brazil pause (`residence_paused`), not a provider's outage. It names no
 * provider outside a provider's rollout, and the provider inside it for a user not on its allowed
 * list (api routing/rank.ts).
 */
export function pixResidencePaused(route: Pick<CapabilityRoute, 'state' | 'reason'> | undefined): boolean {
    return route?.state === 'paused' && route.reason?.code === 'residence_paused'
}

/**
 * Whether Home's Add money drawer offers Pix: the deposit route is Avenia's and not refused (Aleks,
 * 2026-11-14). Every user outside Brazil gets a Manteca route that waits for its first use; that
 * route shows no row, and the user keeps the bank lists' BRL row (`useBankRows`). A user still
 * setting up or under review keeps the row: the first tap starts the setup. An outage of Avenia keeps
 * it too, because the Pix page shows the outage itself (`pixScreen`). The Brazil pause shows no row,
 * whatever provider the route names.
 */
export function pixDepositOffered(route: Pick<CapabilityRoute, 'state' | 'provider' | 'reason'> | undefined): boolean {
    return pixRouteOpen(route) && route?.provider === 'avenia' && !pixResidencePaused(route)
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
 * route, whichever provider serves it. A resident of Brazil gets the local feature refused (another
 * entry serves the residence, `LOCAL_SERVED_ELSEWHERE_REASON`) and Pix from Avenia's route, so the
 * local entry alone would call their Pix closed. A first-use step (terms, the provider's own identity
 * check on its page, the account the first use opens) is the row's own set-up; a pause reads as
 * pending, because it lifts with nothing for the user to do.
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
