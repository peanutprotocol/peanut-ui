/**
 * Support-facing verification snapshot — the state a Crisp agent needs to stop
 * guessing where a user is stuck (issue #2360). Reads the two backend read-models
 * already on the /get-user response (`capabilities`, `identityVerification`) and
 * the on-file email; derives nothing the FE doesn't already render for the user.
 *
 * Everything here is pushed into Crisp `session:data` — the agent sidebar, which
 * only the support agent sees. The user's own message is never touched.
 */

import { deriveGate, railVerdict } from '@/utils/capability-gate'
import type { IdentityVerification, RailOperation, UserCapabilities } from '@/types/capabilities'

const SUMMARY_OPERATIONS: RailOperation[] = ['pay', 'deposit', 'withdraw']

export interface SupportVerificationSummary {
    /** identityVerification.status, or 'unknown' when the read-model is absent. */
    identityStatus: string
    /** whether an email is on file — provider submission can't run without one. */
    emailOnFile: boolean
    /** per-operation gate kinds, e.g. "pay:ready deposit:provide-email withdraw:blocked-rejection". */
    gates: string
    /** the stuck rail's id + normalized reason code + technical details, if any. */
    failureReason?: string
    /** pending next-actions as "kind(purpose)", comma-joined. */
    pendingActions?: string
}

export function buildSupportVerificationSummary(
    capabilities: UserCapabilities | undefined,
    identityVerification: IdentityVerification | undefined,
    email: string | undefined
): SupportVerificationSummary {
    const rails = capabilities?.rails ?? []
    const nextActions = capabilities?.nextActions ?? []
    const identityStatus = identityVerification?.status ?? 'unknown'
    const identityVerified = identityStatus === 'verified'
    const emailOnFile = Boolean(email)

    const gateState = { rails, nextActions, identityVerified, isLoading: false }
    const gateKinds = SUMMARY_OPERATIONS.map((op) => [op, deriveGate(gateState, op).kind] as const)
    const gates = gateKinds.map(([op, kind]) => `${op}:${kind}`).join(' ')

    // "which rail is the user stuck on" — the first rail whose verdict isn't clear.
    const actionByKey = new Map(nextActions.map((action) => [action.key, action]))
    const blocked = rails
        .map((rail) => ({ rail, verdict: railVerdict(rail, actionByKey) }))
        .find(({ verdict }) => verdict.status === 'blocked' || verdict.status === 'fixable')

    let failureReason: string | undefined
    if (blocked?.verdict.blocking) {
        const { code, details } = blocked.verdict.blocking
        failureReason = `${blocked.rail.id} · ${code}${details ? ` — ${details}` : ''}`
    }

    const pendingActions = nextActions.length
        ? nextActions.map((action) => `${action.kind}(${action.purpose})`).join(', ')
        : undefined

    return { identityStatus, emailOnFile, gates, failureReason, pendingActions }
}
