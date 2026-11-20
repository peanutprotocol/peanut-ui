import { accountEntry, VERIFY_ACTION } from '@/features/kyc-features/report'
import { residenceAddressEntry } from '@/features/kyc-features/residenceAddressEntry'
import type { CapabilityRoute, FeatureReport, FeatureReportEntry } from '@/types/capabilities'
import type { GateState } from '@/utils/capability-gate'
import { PIX_ADD_MONEY_PATH, PIX_WITHDRAW_PATH } from '@/features/pix/pix.routes'

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
 * Brazil pause (`paused`, reason `residence_paused`), its provider paused for everyone (`outage`:
 * any other pause, such as Manteca's BRL switched off), or a residence the route does not serve
 * yet (`residence`). Null when the route lets it through, or the API sent no pay route; the
 * payment's own gates then decide.
 */
export type PixPayBlock = 'paused' | 'outage' | 'residence'

export function pixPayBlock(route: CapabilityRoute | undefined): PixPayBlock | null {
    if (route?.state === 'paused') return pixResidencePaused(route) ? 'paused' : 'outage'
    if (route?.state === 'refused' && route.reason?.code === 'residence_not_served') return 'residence'
    return null
}

/** Avenia's refusals of the user: support's to fix, with no fall-back to another provider (API-CONTRACT-M4 §1). */
const AVENIA_REFUSALS: ReadonlySet<string> = new Set(['provider_rejected', 'provider_setup_failed'])

/**
 * Whether a merchant Pix code goes through the neutral pay routes (`/pix/pay/*`): the pay:PIX_BR route
 * names Avenia (API-CONTRACT-M4 §1), whatever its step. A route Avenia refused names no provider; its
 * Avenia candidate says why, and the user is sent to support there, never to Manteca. Any other route
 * keeps Manteca's QR flow as it is.
 */
export function pixPaysThroughPayRoutes(
    route: Pick<CapabilityRoute, 'provider' | 'state' | 'candidates'> | undefined
): boolean {
    if (!route) return false
    if (route.provider === 'avenia') return true
    return (
        route.state === 'refused' &&
        !!route.candidates?.some(
            (candidate) =>
                candidate.provider === 'avenia' &&
                candidate.state === 'refused' &&
                AVENIA_REFUSALS.has(candidate.reason?.code ?? '')
        )
    )
}

/**
 * How Send pays a Pix key for this user. A withdraw route on Avenia pays any key on a payout
 * (TASK-24947), resident of Brazil or not, so the Pix-key form of /withdraw/pix serves the send
 * (`via: 'withdraw'`); the pay route's block does not stop it. Everyone else sends through the pay
 * route (`via: 'pay'`, the QR-payment endpoint) as before, stopped by its block (`pixPayBlock`). A
 * merchant QR code reads the pay route alone: no withdraw route pays one.
 */
export interface PixKeySend {
    via: 'pay' | 'withdraw'
    block: PixPayBlock | null
}

export function pixKeySend(
    payBlock: PixPayBlock | null,
    withdrawRoute: Pick<CapabilityRoute, 'state' | 'provider'> | undefined
): PixKeySend {
    if (withdrawRoute?.provider === 'avenia' && withdrawRoute.state !== 'refused')
        return { via: 'withdraw', block: null }
    return { via: 'pay', block: payBlock }
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
    if (residenceAddressEntry(accountEntry(report, 'local', 'BRL'), [])) return report
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

/**
 * Where a user goes when Manteca refuses to open a Brazil session because their Pix moved
 * (`PIX_PROVIDER_MOVED`): the Pix page that opens their account with no tap. The add-money page
 * where their deposit route is open, else the withdraw page, which every Pix user has (a resident
 * abroad deposits no BRL). Either page reads its route and shows the opening, the wait or the refusal.
 */
export function pixFlowPath(routes: CapabilityRoute[] | undefined): string {
    return pixRouteOpen(findPixRoute(routes, 'deposit')) ? PIX_ADD_MONEY_PATH : PIX_WITHDRAW_PATH
}
