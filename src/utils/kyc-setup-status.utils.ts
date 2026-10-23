import type { KycFeatures, KycProfile } from '@/app/actions/types/kyc-workflow.types'
import { reasonCodeKey } from '@/constants/capability-reason-labels.consts'
import type { NextAction, ProviderCode, RailCapability, RailOperation, UserCapabilities } from '@/types/capabilities'
import { railVerdict } from '@/utils/capability-gate'
import { KYC_FEATURE_KEYS } from '@/utils/kyc-document-plan.utils'

export type KycFeatureKey = keyof KycFeatures

/**
 * A row's state on the setup status drawer. One member here is one badge on
 * the drawer and, for the states with a step, one button.
 *
 * - `document-needed`: a provider asks for one more document
 * - `terms-needed`: the bank terms are still open
 * - `agreements-needed`: the card agreements are still open
 * - `needs-local-id`: the document's issuing country closes this feature; an ID issued by the residence country opens it
 * - `verify-again`: the verified document cannot open this feature; a new identity check with another document can
 * - `not-available`: refused for a reason the user cannot change here
 */
export type SetupRowState =
    | 'setting-up'
    | 'available'
    | 'under-review'
    | 'document-needed'
    | 'terms-needed'
    | 'agreements-needed'
    | 'needs-local-id'
    | 'verify-again'
    | 'not-available'

/** The step behind a row the user acts on: who asks, and the action that opens it. */
export interface SetupRowStep {
    provider: ProviderCode
    action?: NextAction
    reasonCode?: string
}

export interface SetupRow {
    key: KycFeatureKey
    state: SetupRowState
    step?: SetupRowStep
    /** The reason code behind the state; the drawer shows its line when the catalog has one. */
    reason?: string
    /** Not available, and only support can open it. */
    support?: boolean
}

/** The plan's refusal reason per provider, from the profile's onboarding attempts (`providerRefusalsOf`). */
export type SetupRefusals = Partial<Record<ProviderCode, string>>

/** What this flow already sent, while the rails still show the step it answered. */
export interface SetupSubmitted {
    supplements?: ReadonlySet<string>
    terms?: boolean
}

type RailTest = (rail: RailCapability) => boolean
type Outcome = Omit<SetupRow, 'key'>

const FEATURE_PROVIDER: Record<KycFeatureKey, ProviderCode> = {
    qr: 'manteca',
    local: 'manteca',
    bank: 'bridge',
    card: 'rain',
}

/**
 * What a feature needs before it reads "Available": per test, one rail with
 * the operation enabled. QR pays through any Manteca rail. Local bank
 * transfers deposit to the Manteca account of the residence. The card pays
 * through Rain. The accounts use every enrolled Bridge bank rail.
 */
function featureNeeds(key: KycFeatureKey, residence: string | null): { operation: RailOperation; rails: RailTest[] } {
    switch (key) {
        case 'qr':
            return { operation: 'pay', rails: [(rail) => rail.provider === 'manteca'] }
        case 'local':
            return {
                operation: 'deposit',
                rails: [(rail) => rail.provider === 'manteca' && rail.channel === 'bank' && rail.country === residence],
            }
        case 'card':
            return { operation: 'pay', rails: [(rail) => rail.provider === 'rain'] }
        case 'bank':
            return { operation: 'deposit', rails: [(rail) => rail.provider === 'bridge' && rail.channel === 'bank'] }
    }
}

const DOCUMENT_COUNTRY_UNSUPPORTED = 'document_country_unsupported'
const REQUIREMENTS_IN_REVIEW = 'requirements_in_review'
/** The send gate parks a provider no ticked feature asked for; the next save of the set sends to it. */
const PLAN_NOT_REQUESTED = 'not_requested'
const RESTART_IDENTITY_ACTION_KEY = 'restart-identity'
/** Only Bridge and Rain refuse a document for its issuing country (api#1816 `providersFor`). */
const REFUSES_DOCUMENT_COUNTRY: ReadonlySet<ProviderCode> = new Set(['bridge', 'rain'])
/**
 * The plan's refusals of a first-party Manteca account. They leave QR on
 * Peanut's pool, so they close the local bank transfers only; the pool
 * reasons (`under_minimum_age`, `residence_sanctioned`) close QR as well.
 */
const MANTECA_POOL_REASONS: ReadonlySet<string> = new Set(['under_minimum_age', 'residence_sanctioned'])
const MANTECA_ACCOUNT_REASONS: ReadonlySet<string> = new Set([
    'residence_unknown',
    'local_residence_unsupported',
    'manteca_us_nationality_restricted',
    'local_tax_id_missing',
])

// a step the user takes outranks a refusal on a sibling rail, a refusal outranks a wait
const RANK: Record<SetupRowState, number> = {
    'needs-local-id': 7,
    'verify-again': 6,
    'terms-needed': 5,
    'agreements-needed': 5,
    'document-needed': 4,
    'not-available': 3,
    'under-review': 2,
    'setting-up': 1,
    available: 0,
}

const restartOutcome = (reason: string | undefined, provider: ProviderCode): Outcome =>
    reason === DOCUMENT_COUNTRY_UNSUPPORTED && REFUSES_DOCUMENT_COUNTRY.has(provider)
        ? { state: 'needs-local-id', reason }
        : { state: 'verify-again', ...(reason && reason !== DOCUMENT_COUNTRY_UNSUPPORTED ? { reason } : {}) }

function railOutcome(
    rail: RailCapability,
    operation: RailOperation,
    actions: Map<string, NextAction>,
    submitted: SetupSubmitted
): Outcome {
    const verdict = railVerdict(rail, actions)
    const reason = rail.reason?.code ?? verdict.blocking?.code
    const action = verdict.nextAction
    const status = rail.status === 'pending' ? 'pending' : (rail.operations?.[operation] ?? rail.status)

    if (reason === REQUIREMENTS_IN_REVIEW) return { state: 'under-review', reason }
    if (action?.key.startsWith('supplement:') && submitted.supplements?.has(action.key)) {
        return { state: 'under-review', reason: REQUIREMENTS_IN_REVIEW }
    }
    if (action?.kind === 'restart-identity' || verdict.blocking?.selfHealKind === 'restart-identity') {
        return restartOutcome(action?.kind === 'restart-identity' ? (reason ?? action.purpose) : reason, rail.provider)
    }
    if (action?.kind === 'accept-tos') {
        return submitted.terms
            ? { state: 'setting-up' }
            : { state: 'terms-needed', step: { provider: rail.provider, action }, reason }
    }
    if (verdict.status === 'fixable' && verdict.blocking?.selfHealKind === 'document-resubmit') {
        return { state: 'document-needed', step: { provider: rail.provider, action, reasonCode: reason }, reason }
    }
    if (status === 'pending' || verdict.status === 'pending') {
        return action?.kind === 'wait' ? { state: 'under-review', reason } : { state: 'setting-up' }
    }
    if (reason === PLAN_NOT_REQUESTED) return { state: 'setting-up' }
    // an enabled rail with the operation blocked and no reason is a card still being issued
    if (verdict.status === 'blocked' || (status === 'blocked' && verdict.status === 'enabled' && reason)) {
        const support = (rail.blockingActions ?? []).some((key) => actions.get(key)?.kind === 'contact-support')
        return { state: 'not-available', ...(reason ? { reason } : {}), ...(support ? { support } : {}) }
    }
    // provisioning, or a step this drawer has no state for (an email to add)
    return { state: 'setting-up' }
}

/** A plan refusal of the row's provider, scoped by the same rules as a refusal on a rail. */
function refusalOutcome(key: KycFeatureKey, refusals: SetupRefusals): Outcome | null {
    const provider = FEATURE_PROVIDER[key]
    const reason = refusals[provider]
    if (!reason || reason === PLAN_NOT_REQUESTED) return null
    if (key === 'qr' && !MANTECA_POOL_REASONS.has(reason)) return null
    if (reason === DOCUMENT_COUNTRY_UNSUPPORTED) {
        return REFUSES_DOCUMENT_COUNTRY.has(provider) ? { state: 'needs-local-id', reason } : null
    }
    return { state: 'not-available', reason }
}

function featureOutcome(
    key: KycFeatureKey,
    rails: RailCapability[],
    actions: Map<string, NextAction>,
    residence: string | null,
    submitted: SetupSubmitted,
    refusals: SetupRefusals
): Outcome {
    const needs = featureNeeds(key, residence)
    const works = (rail: RailCapability) => (rail.operations?.[needs.operation] ?? rail.status) === 'enabled'
    // an enabled rail outranks every answer about its provider
    const serving = rails.filter((rail) => needs.rails.some((serves) => serves(rail)))
    if (
        key === 'bank'
            ? serving.length > 0 && serving.every(works)
            : needs.rails.every((serves) => rails.some((rail) => serves(rail) && works(rail)))
    )
        return { state: 'available' }

    // A provider the plan refused for the document's country was never
    // enrolled, so no rail carries it: the top-level restart action names it.
    const orphan = actions.get(RESTART_IDENTITY_ACTION_KEY)
    const asksForLocalId = orphan?.kind === 'restart-identity' && orphan.purpose === DOCUMENT_COUNTRY_UNSUPPORTED
    const own = serving.filter((rail) => !works(rail))
    // an API without `refused` names no provider: a feature with no rail of its own is the refused one
    const refused = orphan?.refused
        ? orphan.refused.some((entry) => entry.provider === FEATURE_PROVIDER[key])
        : serving.length === 0
    if (asksForLocalId && refused && REFUSES_DOCUMENT_COUNTRY.has(FEATURE_PROVIDER[key])) {
        return { state: 'needs-local-id', reason: DOCUMENT_COUNTRY_UNSUPPORTED }
    }

    const refusal = refusalOutcome(key, refusals)
    // the card has no rail until the card page applies, after its agreements
    if (key === 'card' && own.length === 0) return refusal ?? { state: 'agreements-needed', step: { provider: 'rain' } }

    return own
        .map((rail) => railOutcome(rail, needs.operation, actions, submitted))
        .map((outcome) =>
            key === 'qr' && outcome.reason && MANTECA_ACCOUNT_REASONS.has(outcome.reason)
                ? { state: 'setting-up' as const }
                : outcome
        )
        .concat(refusal ? [refusal] : [])
        .reduce<Outcome>((best, next) => (RANK[next.state] > RANK[best.state] ? next : best), { state: 'setting-up' })
}

/**
 * One row per saved feature, in feature order. Until the identity is
 * verified no rail says anything yet, so every row waits on that one check.
 *
 * @param input.residence ISO-2 residence: the country of the local bank transfers
 * @param input.submitted what this flow already sent and the rails do not show yet
 * @param input.refusals the plan's refusals no rail carries (a provider the approval never enrolled)
 */
export function setupRows(input: {
    features: KycFeatures
    residence: string | null
    capabilities: UserCapabilities | undefined
    identityVerified: boolean
    submitted?: SetupSubmitted
    refusals?: SetupRefusals
}): SetupRow[] {
    const { rails = [], nextActions = [] } = input.capabilities ?? {}
    const actions = new Map(nextActions.map((action) => [action.key, action]))
    return KYC_FEATURE_KEYS.filter((key) => input.features[key]).map((key) =>
        input.identityVerified
            ? {
                  key,
                  ...featureOutcome(key, rails, actions, input.residence, input.submitted ?? {}, input.refusals ?? {}),
              }
            : { key, state: 'under-review' }
    )
}

// The plan's own refusals (`GET /config/kyc-intents` codes), beside the shared
// registry: the card page reads that registry to decide which refusals it
// explains itself. `document_country_unsupported` has its own state and line.
const PLAN_REASON_KEYS = {
    local_tax_id_missing: 'reasons.local_tax_id_missing',
    under_minimum_age: 'reasons.under_minimum_age',
    manteca_us_nationality_restricted: 'reasons.manteca_us_nationality',
} as const

/** The `identity` catalog key of a row's line, or undefined when the reason has none. */
export const setupReasonKey = (reason: string | undefined) =>
    reasonCodeKey(reason) ??
    (reason && reason in PLAN_REASON_KEYS ? PLAN_REASON_KEYS[reason as keyof typeof PLAN_REASON_KEYS] : undefined)

const PROFILE_PROVIDERS: Record<string, ProviderCode | undefined> = {
    BRIDGE: 'bridge',
    MANTECA: 'manteca',
    RAIN: 'rain',
}

/**
 * The plan's refusals of the current identity's providers. The approval
 * records one onboarding attempt per requested provider; a refused one is
 * REJECTED by POLICY with the plan's reason, and is often the only trace (a
 * provider the plan refused is never enrolled, so no rail names it). The
 * latest attempt per provider decides, so a later plan that sends to it
 * clears an older refusal.
 *
 * @returns the refusals, and whether the plan has been recorded yet (the
 *     approval records it after the identity status changes)
 */
export function providerRefusalsOf(profile: Pick<KycProfile, 'identity' | 'attempts'>): {
    refusals: SetupRefusals
    recorded: boolean
} {
    const identityId = profile.identity?.verificationId
    const sources = new Set(
        profile.attempts
            .filter((a) => a.kind === 'IDENTITY' && a.verificationId === identityId && a.status !== 'SUPERSEDED')
            .map((a) => a.id)
    )
    const latest = new Map<ProviderCode, KycProfile['attempts'][number]>()
    for (const attempt of profile.attempts) {
        const provider = PROFILE_PROVIDERS[attempt.provider]
        if (attempt.kind !== 'ONBOARDING' || !provider || attempt.status === 'SUPERSEDED') continue
        if (!attempt.sourceAttemptId || !sources.has(attempt.sourceAttemptId)) continue
        const seen = latest.get(provider)
        if (!seen || attempt.createdAt > seen.createdAt) latest.set(provider, attempt)
    }
    const refusals: SetupRefusals = {}
    for (const [provider, attempt] of latest) {
        if (attempt.status === 'REJECTED' && attempt.decisionSource === 'POLICY' && attempt.reasonCode) {
            refusals[provider] = attempt.reasonCode
        }
    }
    return { refusals, recorded: latest.size > 0 }
}
