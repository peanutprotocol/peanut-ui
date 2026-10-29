/**
 * Fixtures and tests: the API's feature report (peanut-api-ts
 * `src/kyc/feature-report.ts`) computed from rail fixtures, so a test that
 * describes a user by their rails gets the report the API would send for
 * them. The app itself never computes a report; it renders the API's.
 *
 * Kept in step with the API by hand. The residence engine stays in the API:
 * a fixture names a residence refusal by product (`productRefusals`).
 */
import type {
    FeatureReport,
    FeatureReportEntry,
    IdentityVerificationStatus,
    NextAction,
    RailCapability,
    RailOperation,
    UserCapabilities,
} from '@/types/capabilities'

type KycIntent = keyof FeatureReport
const IDENTITY_REGION_RESTRICTED_CODE = 'identity_region_restricted'

/** A capability block with the report the API would send for its rails. */
export function withFeatureReport(
    capabilities: Pick<UserCapabilities, 'rails' | 'nextActions'> & Partial<Pick<UserCapabilities, 'restrictions'>>,
    input: Partial<Omit<FeatureReportInput, 'rails' | 'nextActions'>> = {}
): UserCapabilities {
    return {
        restrictions: [],
        ...capabilities,
        features: featureReport({
            rails: capabilities.rails,
            nextActions: capabilities.nextActions,
            identity: { status: 'verified' },
            residence: null,
            ...input,
        }),
    }
}

const VERIFY_ACTION = 'verify'
const ACTIVATE_ACTION = 'activate'
const IDENTITY_ACTION = 'identity'

const BANK_ACCOUNT_PRODUCTS: Readonly<Record<string, string>> = {
    USD: 'bridge.usd',
    EUR: 'bridge.eur',
    GBP: 'bridge.gbp',
    MXN: 'bridge.mxn',
}
const LOCAL_ACCOUNT_COUNTRIES: Readonly<Record<string, string>> = { BRL: 'BR', ARS: 'AR' }

/** A refusal that only a person can lift; verifying again never clears it (TASK-24046). */
const SUPPORT_CASES: Readonly<Record<string, string>> = {
    duplicate_account: 'duplicate_account',
    imported_identity_rejected: 'imported_identity_rejected',
    imported_identity_review: 'imported_identity_rejected',
}
const DUPLICATE_EMAIL_LABEL = 'DUPLICATE_EMAIL'
const MANTECA_ACCOUNT_REJECTED = 'manteca_account_rejected'

export interface FeatureReportInput {
    rails: RailCapability[]
    nextActions: NextAction[]
    identity: {
        status: IdentityVerificationStatus
        reason?: { code: string; userMessage?: string }
        rejectLabels?: string[]
    }
    /** Why the last plan closed a provider, by provider: the plan records and the policy-rejected attempts. */
    planReasons?: Partial<Record<'bridge' | 'manteca' | 'rain', string>> | null
    /** The provider plan's own verdicts, when a record holds them; absent means "only the reasons are known". */
    plan?: { bridge: boolean; manteca: 'full' | 'pool' | 'none'; rain: boolean } | null
    /** The residence the features are offered for: the current approved one, else the declared one. */
    residence: string | null
    /**
     * The residence restrictions `/users/me` reports: the approval rules' once
     * an approval exists, the declaration's before. `banking` carries the
     * refusal the bank routes give (`uk_resident_blocked`, `residence_bank_restricted`).
     */
    restrictions?: { banking: { code: string; userMessage: string } | null; card: boolean } | null
    /** ISO-2 countries whose Manteca account Manteca closed (`isMantecaAccountRejected`). */
    mantecaClosedCountries?: ReadonlySet<string>
    /** The feature's first use opens it (`POST /users/kyc/features/:feature/activate`). */
    activatesOnFirstUse?: boolean
    /** The paperwork engine's refusals from the residence, by product (`bridge.usd`, `rain.card`, `manteca.local`). */
    productRefusals?: Record<string, string>
}

interface Candidate {
    rail: RailCapability
    verdict: NonNullable<RailCapability['resolved']>
}

export function featureReport(input: FeatureReportInput): FeatureReport {
    const actions = new Map(input.nextActions.map((action) => [action.key, action]))
    const scope = (provider: RailCapability['provider'], filter: (rail: RailCapability) => boolean = () => true) =>
        input.rails.filter((rail) => rail.provider === provider && filter(rail))
    const identity = identityEntry(input)

    const bridge = scope('bridge')
    const bankCurrencies = [...new Set([...Object.keys(BANK_ACCOUNT_PRODUCTS), ...bridge.map((rail) => rail.currency)])]
    const bankAccounts = Object.fromEntries(
        bankCurrencies.map((currency) => [
            currency,
            entryFor(input, actions, identity, {
                feature: 'bank',
                rails: bridge.filter((rail) => rail.currency === currency),
                op: 'deposit',
                refusal: accountRefusal(input, currency) ?? bankRefusal(input),
            }),
        ])
    )
    const [firstAccount, ...otherAccounts] = Object.keys(BANK_ACCOUNT_PRODUCTS).map((currency) =>
        accountRefusal(input, currency)
    )
    const residenceRefusesBank = !!firstAccount && otherAccounts.every(Boolean)
    const bank = entryFor(input, actions, identity, {
        feature: 'bank',
        rails: bridge,
        op: 'deposit',
        refusal: bankRefusal(input) ?? (residenceRefusesBank ? { reason: providerReason(firstAccount.reason) } : null),
    })

    const mantecaBank = scope('manteca', (rail) => rail.channel === 'bank')
    const localAccounts = Object.fromEntries(
        Object.entries(LOCAL_ACCOUNT_COUNTRIES).map(([currency, country]) => [
            currency,
            entryFor(input, actions, identity, {
                feature: 'local',
                rails: mantecaBank.filter((rail) => rail.country === country),
                op: 'deposit',
                refusal: input.mantecaClosedCountries?.has(country)
                    ? { reason: MANTECA_ACCOUNT_REJECTED }
                    : localRefusal(input, country),
            }),
        ])
    )
    const local = entryFor(input, actions, identity, {
        feature: 'local',
        rails: mantecaBank.filter((rail) => Object.values(LOCAL_ACCOUNT_COUNTRIES).includes(rail.country)),
        op: 'deposit',
        refusal: featureRefusal(input, 'local') ?? everyAccountRefusal(Object.values(localAccounts)),
    })

    return {
        qr: entryFor(input, actions, identity, {
            feature: 'qr',
            rails: scope('manteca'),
            op: 'pay',
            refusal: featureRefusal(input, 'qr') ?? reasonOnly(productRefusal(input, 'manteca.qr')),
        }),
        local: { ...local, accounts: localAccounts },
        bank: { ...bank, accounts: bankAccounts },
        // The application is the feature; whether a card is already issued is the card screen's business.
        card: entryFor(input, actions, identity, {
            feature: 'card',
            rails: scope('rain'),
            refusal:
                featureRefusal(input, 'card') ??
                reasonOnly(productRefusal(input, 'rain.card')) ??
                (input.restrictions?.card ? { reason: 'geo-blocked' } : null),
        }),
    }
}

/** The answer for a scope with no working rail and nothing the rails say: the identity's. Null once it is approved. */
function identityEntry(input: FeatureReportInput): FeatureReportEntry | null {
    const { identity } = input
    const supportCase = supportCaseOf(identity.reason?.code)
    if (supportCase) return { state: 'refused', reason: supportCase, ...messageOf(identity.reason?.userMessage) }
    if (identity.status === 'action_required' && identity.rejectLabels?.includes(DUPLICATE_EMAIL_LABEL))
        return { state: 'refused', reason: SUPPORT_CASES.duplicate_account }
    if (identity.status === 'verified') return null
    if (identity.status === 'failed')
        return {
            state: 'refused',
            reason: identity.reason?.code ?? 'identity_rejected',
            action: IDENTITY_ACTION,
            ...messageOf(identity.reason?.userMessage),
        }
    return {
        state: 'action_required',
        action: VERIFY_ACTION,
        ...(identity.status === 'processing' ? { reason: 'identity_in_review' } : {}),
    }
}

function entryFor(
    input: FeatureReportInput,
    actions: Map<string, NextAction>,
    identity: FeatureReportEntry | null,
    scope: {
        feature: KycIntent
        rails: RailCapability[]
        op?: RailOperation
        refusal: { reason: string; message?: string } | null
    }
): FeatureReportEntry {
    // A pool QR rail granted before a jurisdictional refusal of the ID is never revoked; the refusal still stands.
    if (scope.feature === 'qr' && regionRefused(input))
        return {
            state: 'refused',
            reason: IDENTITY_REGION_RESTRICTED_CODE,
            action: IDENTITY_ACTION,
            ...messageOf(input.identity.reason?.userMessage),
        }

    const verdicts: Candidate[] = scope.rails.map((rail) => ({ rail, verdict: verdictOf(rail) }))
    const working = verdicts.filter(
        ({ rail }) => (scope.op ? (rail.operations?.[scope.op] ?? rail.status) : rail.status) === 'enabled'
    )
    if (working.length) {
        const advisory = earliestAdvisory(working)
        return { state: 'on', ...(advisory ? { action: advisory.key } : {}) }
    }
    // A rail that works for another operation says nothing here: a pool QR rail is no Manteca account.
    const candidates = verdicts.filter(({ verdict }) => verdict.status !== 'enabled')

    for (const { rail, verdict } of candidates) {
        const supportCase =
            supportCaseOf(rail.reason?.code) ??
            supportCaseOf(verdict.blocking?.code) ??
            [verdict.nextAction, ...railActions(rail, actions)]
                .map((action) => supportCaseOf(action?.purpose))
                .find(Boolean)
        if (supportCase)
            return {
                state: 'refused',
                reason: supportCase,
                ...messageOf(verdict.blocking?.userMessage ?? rail.reason?.userMessage),
            }
    }

    if (scope.refusal) return refusedEntry(scope.refusal.reason, scope.refusal.message, actions)

    const fromRails = railsEntry(candidates, actions, input)
    if (fromRails) return fromRails

    if (identity) return identity
    return {
        state: 'ready',
        ...(input.activatesOnFirstUse && scope.feature !== 'qr' ? { action: ACTIVATE_ACTION } : {}),
    }
}

/**
 * The rails' own verdicts, most actionable first (the order the app's
 * capability gate used): a missing email unblocks every rail at once, a
 * terminal block outranks a sibling's restart, a step to take outranks
 * provisioning, and an action-less fix ranks below provisioning.
 */
function railsEntry(
    candidates: Candidate[],
    actions: Map<string, NextAction>,
    input: FeatureReportInput
): FeatureReportEntry | null {
    const fix = ({ rail, verdict }: Candidate, action?: NextAction): FeatureReportEntry => ({
        state: 'action_required',
        ...reasonOf(rail, verdict),
        ...(action ? { action: action.key } : {}),
    })

    const email = candidates.find(({ verdict }) => verdict.blocking?.selfHealKind === 'provide-email')
    if (email) return fix(email, email.verdict.nextAction)

    const blocked = candidates.find(({ verdict }) => verdict.status === 'blocked')
    if (blocked) {
        if (blocked.verdict.blocking?.selfHealKind === 'restart-identity')
            return fix(blocked, blocked.verdict.nextAction)
        const support = blocked.verdict.nextAction?.kind === 'contact-support' ? blocked.verdict.nextAction : undefined
        return {
            state: 'refused',
            ...reasonOf(blocked.rail, blocked.verdict),
            ...(support ? { action: support.key } : {}),
        }
    }

    const fixables = candidates.filter(({ verdict }) => verdict.status === 'fixable')
    const restart = fixables.find(
        ({ verdict }) =>
            verdict.blocking?.selfHealKind === 'restart-identity' || verdict.nextAction?.kind === 'restart-identity'
    )
    if (restart) return fix(restart, restart.verdict.nextAction)
    const tos = fixables.find(({ verdict }) => verdict.nextAction?.kind === 'accept-tos')
    if (tos) return fix(tos, tos.verdict.nextAction)
    const actionable = fixables.find(({ verdict }) => verdict.nextAction !== undefined)
    if (actionable) return fix(actionable, actionable.verdict.nextAction)

    const provisioning = candidates.find(
        ({ verdict }) => verdict.status === 'pending' && verdict.nextAction?.kind !== 'wait'
    )
    if (provisioning)
        return {
            state: 'setting_up',
            ...(provisioning.rail.reason?.code === 'requirements_in_review'
                ? reasonOf(provisioning.rail, provisioning.verdict)
                : {}),
            ...(provisioning.rail.pendingSince ? { since: provisioning.rail.pendingSince } : {}),
        }

    const [punt] = fixables
    if (punt) {
        // When Bridge waits on its hosted check, a resubmit only re-runs the ID check Bridge already has.
        const hosted = punt.rail.provider === 'bridge' ? dueBridgeHostedAction(input, actions) : undefined
        return fix(punt, hosted)
    }

    const waiting = candidates.find(
        ({ verdict }) => verdict.status === 'pending' && verdict.nextAction?.kind === 'wait'
    )
    if (waiting)
        return {
            state: 'setting_up',
            ...reasonOf(waiting.rail, waiting.verdict),
            ...(waiting.verdict.nextAction ? { action: waiting.verdict.nextAction.key } : {}),
            ...(waiting.rail.pendingSince ? { since: waiting.rail.pendingSince } : {}),
        }
    return null
}

/** The resolver always emits `resolved`; the fallback only keeps a hand-built rail readable. */
function verdictOf(rail: RailCapability): Candidate['verdict'] {
    return rail.resolved ?? { status: rail.status === 'requires-info' ? 'fixable' : rail.status }
}

function refusedEntry(
    reason: string,
    message: string | undefined,
    actions: Map<string, NextAction>
): FeatureReportEntry {
    // A document whose issuing country a provider refuses is fixed by verifying with another one.
    const restart = [...actions.values()].find(
        (action) => action.kind === 'restart-identity' && action.refused?.some((refusal) => refusal.reason === reason)
    )
    return { state: 'refused', reason, ...messageOf(message), ...(restart ? { action: restart.key } : {}) }
}

const FEATURE_PROVIDER: Record<KycIntent, 'bridge' | 'manteca' | 'rain'> = {
    qr: 'manteca',
    local: 'manteca',
    bank: 'bridge',
    card: 'rain',
}

/**
 * The plan's refusal of the feature's provider. A Manteca reason refuses the
 * local account; QR closes only on a plan whose pool is closed too, because a
 * policy-rejected Manteca attempt is always the first-party account.
 */
function featureRefusal(input: FeatureReportInput, feature: KycIntent): { reason: string } | null {
    const reason = input.planReasons?.[FEATURE_PROVIDER[feature]]
    if (!reason) return null
    if (feature === 'qr' && input.plan?.manteca !== 'none') return null
    return { reason }
}

/** The plan's refusal of Bridge, else the banking residence gate's (`uk_resident_blocked`, `residence_bank_restricted`). */
function bankRefusal(input: FeatureReportInput): { reason: string; message?: string } | null {
    const banking = input.restrictions?.banking
    return featureRefusal(input, 'bank') ?? (banking ? { reason: banking.code, message: banking.userMessage } : null)
}

function localRefusal(input: FeatureReportInput, country: string): { reason: string } | null {
    const refusal = featureRefusal(input, 'local') ?? reasonOnly(productRefusal(input, 'manteca.local'))
    if (refusal) return refusal
    // A first-party Manteca account is for residents of its own country.
    return input.residence && input.residence !== country ? { reason: 'local_residence_unsupported' } : null
}

/** A Bridge account the residence does not get (Bangladesh no USD, Mali no EUR), as `/users/kyc/paperwork` gives it. */
function accountRefusal(input: FeatureReportInput, currency: string): { reason: string } | null {
    const product = BANK_ACCOUNT_PRODUCTS[currency]
    return product ? reasonOnly(productRefusal(input, product)) : null
}

/** Fixtures name the paperwork engine's residence refusals by product; the engine stays in the API. */
function productRefusal(input: FeatureReportInput, product: string): string | null {
    return input.productRefusals?.[product] ?? null
}

function reasonOnly(reason: string | null): { reason: string } | null {
    return reason ? { reason } : null
}

/** Every Bridge account refused one by one is, for the feature, a residence refusal (`providersFor`). */
function providerReason(reason: string): string {
    return reason === 'account_unavailable_in_residence' ? 'residence_bank_restricted' : reason
}

function earliestAdvisory(candidates: Candidate[]): NextAction | undefined {
    let best: NextAction | undefined
    for (const { verdict } of candidates) {
        const action = verdict.nextAction
        if (action?.effectiveDate && (!best || action.effectiveDate < best.effectiveDate!)) best = action
    }
    return best
}

/** Bridge's hosted check while it is what Bridge waits on; it stands down beside a Sumsub step on a Bridge rail. */
function dueBridgeHostedAction(input: FeatureReportInput, actions: Map<string, NextAction>): NextAction | undefined {
    const hosted = input.nextActions.find((action) => action.kind === 'bridge-hosted' && !action.effectiveDate)
    if (!hosted) return undefined
    const nativeStep = input.rails.some(
        (rail) =>
            rail.provider === 'bridge' &&
            rail.status === 'requires-info' &&
            railActions(rail, actions).some((action) => action.kind === 'sumsub')
    )
    return nativeStep ? undefined : hosted
}

function railActions(rail: RailCapability, actions: Map<string, NextAction>): NextAction[] {
    return (rail.blockingActions ?? []).flatMap((key): NextAction[] => {
        const action = actions.get(key)
        return action ? [action] : []
    })
}

/** A feature whose every account is refused is refused, for the first account's reason. */
function everyAccountRefusal(accounts: FeatureReportEntry[]): { reason: string; message?: string } | null {
    const first = accounts.find((account) => account.reason)
    if (!first?.reason || !accounts.every((account) => account.state === 'refused')) return null
    return { reason: first.reason, ...messageOf(first.message) }
}

function reasonOf(rail: RailCapability, verdict: Candidate['verdict']): Pick<FeatureReportEntry, 'reason' | 'message'> {
    const code = verdict.blocking?.code ?? rail.reason?.code
    return {
        ...(code ? { reason: code } : {}),
        ...messageOf(verdict.blocking?.userMessage || rail.reason?.userMessage),
    }
}

function messageOf(message: string | undefined): Pick<FeatureReportEntry, 'message'> {
    return message ? { message } : {}
}

function regionRefused(input: FeatureReportInput): boolean {
    return input.identity.status === 'failed' && input.identity.reason?.code === IDENTITY_REGION_RESTRICTED_CODE
}

function supportCaseOf(value: string | null | undefined): string | undefined {
    return value ? SUPPORT_CASES[value.replace(/-/g, '_')] : undefined
}
