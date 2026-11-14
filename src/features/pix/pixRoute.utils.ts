import { VERIFY_ACTION } from '@/features/kyc-features/report'
import { isProviderOwnSetUp, pixRouteStep } from '@/features/pix/pixRouteStep'
import type { CapabilityRoute, FeatureReport, FeatureReportEntry, NextAction } from '@/types/capabilities'
import type { GateState } from '@/utils/capability-gate'

export const PIX_METHOD = 'PIX_BR'
/** The country the Pix rails carry, as the rails name their jurisdiction. */
export const PIX_COUNTRY = 'BR'

export function findPixRoute(
    routes: CapabilityRoute[] | undefined,
    operation: CapabilityRoute['operation']
): CapabilityRoute | undefined {
    return routes?.find((route) => route.operation === operation && route.method === PIX_METHOD)
}

/**
 * Where a plan that adds money by Pix stands with the Pix provider's own set-up, which Home shows in
 * place of our identity check (TASK-24841): `provider-step` while the deposit route asks for the
 * provider's terms or its own check, `done` once the provider reviews or serves it. Null for any other
 * plan, for a user our check verified, and where the route asks for our check: Home then shows our
 * check as usual.
 *
 * Home follows the signup plan. The bank lists' BRL row follows the route and leaves for any open
 * one, Pix then leading Home's Add money drawer (`useBankRows`, Aleks 2026-11-12).
 */
export type PixPlanSetUp = 'provider-step' | 'done' | null

export function pixPlanSetUp(
    fundingChannel: string | null | undefined,
    verifiedByUs: boolean,
    route: Pick<CapabilityRoute, 'state' | 'action'> | undefined,
    nextActions: readonly NextAction[]
): PixPlanSetUp {
    if (fundingChannel !== 'brlBank' || verifiedByUs) return null
    const step = pixRouteStep(route, nextActions)
    if (isProviderOwnSetUp(step)) return 'provider-step'
    return step === 'pending' || step === 'ready' ? 'done' : null
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
 * Whether Home's Add money drawer offers Pix: the API sent a Pix deposit route and did not refuse
 * it. A paused route stays on offer, because the Pix page shows the outage itself (`pixScreen`).
 */
export function pixRouteOpen(route: Pick<CapabilityRoute, 'state'> | undefined): boolean {
    return !!route && route.state !== 'refused'
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
 * How Send pays a Pix key for this user. Through the pay route (`via: 'pay'`, the QR-payment
 * endpoint, any key), or, for a residence the pay route does not serve, through the withdraw route
 * when that one is open (`via: 'withdraw'`): its provider pays any key on a payout (TASK-24910), so
 * the Pix-key form of /withdraw/pix serves the send. `block` is what stops the send: the pay
 * route's block (`pixPayBlock`), none when the withdraw route takes it. A merchant QR code still
 * reads the pay route alone: no withdraw route pays one.
 */
export interface PixKeySend {
    via: 'pay' | 'withdraw'
    block: PixPayBlock | null
}

export function pixKeySend(
    payBlock: PixPayBlock | null,
    withdrawRoute: Pick<CapabilityRoute, 'state'> | undefined
): PixKeySend {
    if (payBlock === 'residence' && withdrawRoute && withdrawRoute.state !== 'refused')
        return { via: 'withdraw', block: null }
    return { via: 'pay', block: payBlock }
}

/**
 * The BRL account as the account screens read it, from the Pix deposit route: Pix comes from the
 * route, whichever provider serves it. The local feature can be refused while another entry serves
 * the residence's Pix (`LOCAL_SERVED_ELSEWHERE_REASON`), so the local entry alone would call that Pix
 * closed. A first-use step (terms, the provider's own identity check on its page, the account the
 * first use opens) is the row's own set-up; a pause reads as pending, because it lifts with nothing
 * for the user to do.
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
