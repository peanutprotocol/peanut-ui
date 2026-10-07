import { KYC_INTENT_KEYS, type KycIntentKey, type KycIntentSet } from '@/services/kyc-intents'
import type { NextAction, ProviderCode, RailCapability, RailOperation, UserCapabilities } from '@/types/capabilities'
import { railVerdict } from '@/utils/capability-gate'
import { cardRowState, DOCUMENT_COUNTRY_UNSUPPORTED, type CardChainState } from '@/utils/one-shot-card.utils'

/**
 * A row's state on the one-shot setup drawer (TASK-23329). Item 9a gave the
 * three states of a wait; item 9b adds the states a user acts on, or must
 * read. One member here is one badge on the drawer and, for the states with a
 * step, one button.
 *
 * - `document-needed`: a provider asks for one document; the existing resubmit path uploads it
 * - `agreements-needed`: the card questions or the cardholder agreements are open
 * - `needs-local-id`: the document's issuing country closes this feature; a new identity check with an ID issued by the residence country opens it
 * - `checking`: the card issuer gave an unclear answer; a person checks it, the user waits
 * - `occupation-not-accepted`: the card issuer does not accept the occupation given; support is the way out
 * - `not-available`: refused for a reason the user cannot change here
 */
export type SetupRowState =
    | 'setting-up'
    | 'available'
    | 'under-review'
    | 'document-needed'
    | 'agreements-needed'
    | 'needs-local-id'
    | 'checking'
    | 'occupation-not-accepted'
    | 'not-available'

/** The step behind a `document-needed` row: who asks, and the action that opens the upload. */
export interface SetupRowStep {
    provider: ProviderCode
    action?: NextAction
    reasonCode?: string
}

export interface SetupRow {
    key: KycIntentKey
    state: SetupRowState
    step?: SetupRowStep
}

type RailTest = (rail: RailCapability) => boolean

const bridgeAccount =
    (currency: string): RailTest =>
    (rail) =>
        rail.provider === 'bridge' && rail.channel === 'bank' && rail.currency === currency

/**
 * What a feature needs before it reads "Available": per test, one rail with
 * the operation enabled. The tests follow what the row promises. QR pays
 * through any Manteca rail (the QR gate's own test). Local bank transfers
 * deposit to the Manteca account of the residence. The card pays through
 * Rain. "USD and EUR accounts" needs both, so a GBP or MXN rail, or one of
 * the two alone, never answers for it.
 */
function featureNeeds(key: KycIntentKey, residence: string): { operation: RailOperation; rails: RailTest[] } {
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
            return { operation: 'deposit', rails: [bridgeAccount('USD'), bridgeAccount('EUR')] }
    }
}

/** The stable key of the "verify again" action the API emits (capabilities resolver). */
const RESTART_IDENTITY_ACTION_KEY = 'restart-identity'

const asksForLocalId = (action: NextAction | undefined): boolean =>
    action?.kind === 'restart-identity' && action.purpose === DOCUMENT_COUNTRY_UNSUPPORTED

/**
 * The orphan "verify again with a local ID" action: the plan refused a
 * provider for the document's issuing country, so that provider was never
 * enrolled and no rail can carry the step.
 */
export function localIdRestartAction(
    actions: Pick<UserCapabilities, 'nextActions'> | undefined
): NextAction | undefined {
    const action = actions?.nextActions.find((candidate) => candidate.key === RESTART_IDENTITY_ACTION_KEY)
    return asksForLocalId(action) ? action : undefined
}

function railState(
    rails: RailCapability[],
    needs: ReturnType<typeof featureNeeds>,
    actions: Map<string, NextAction>
): { state: SetupRowState; step?: SetupRowStep } {
    const works = (rail: RailCapability) => (rail.operations?.[needs.operation] ?? rail.status) === 'enabled'
    if (needs.rails.every((serves) => rails.some((rail) => serves(rail) && works(rail)))) return { state: 'available' }
    const own = rails.filter((rail) => needs.rails.some((serves) => serves(rail)))
    const verdicts = own.map((rail) => ({ rail, verdict: railVerdict(rail, actions) }))
    // a step the user takes outranks a wait; a refusal outranks both
    const localId = verdicts.find(({ verdict }) => asksForLocalId(verdict.nextAction))
    if (localId) return { state: 'needs-local-id' }
    const document = verdicts.find(
        ({ verdict }) => verdict.status === 'fixable' && verdict.blocking?.selfHealKind === 'document-resubmit'
    )
    if (document) {
        return {
            state: 'document-needed',
            step: {
                provider: document.rail.provider,
                action: document.verdict.nextAction,
                reasonCode: document.verdict.blocking?.code,
            },
        }
    }
    if (verdicts.some(({ verdict }) => verdict.status === 'blocked')) return { state: 'not-available' }
    // the verdict's wait marker: a provider holds the dossier and is deciding
    if (verdicts.some(({ verdict }) => verdict.status === 'pending' && verdict.nextAction?.kind === 'wait')) {
        return { state: 'under-review' }
    }
    // never enrolled because of the document: the orphan action says so
    if (own.length === 0 && asksForLocalId(actions.get(RESTART_IDENTITY_ACTION_KEY))) return { state: 'needs-local-id' }
    // no rail yet, provisioning, or a step this drawer has no state for (an email to add)
    return { state: 'setting-up' }
}

/**
 * One row per ticked feature, in checklist order. Until the identity is
 * verified no rail says anything yet, so every row waits on that one check,
 * except the card: its own step runs beside the identity check and says
 * where it stands (`card`).
 *
 * @param input.residence ISO-2 declared residence: the country of the local bank transfers
 * @param input.card the card step's state, when the app knows it
 */
export function setupRows(input: {
    intents: KycIntentSet
    residence: string
    capabilities: UserCapabilities | undefined
    identityVerified: boolean
    card?: CardChainState | null
}): SetupRow[] {
    const { rails = [], nextActions = [] } = input.capabilities ?? {}
    const actions = new Map(nextActions.map((action) => [action.key, action]))
    const cardStep = cardRowState(input.card)
    return KYC_INTENT_KEYS.filter((key) => input.intents[key]).map((key) => {
        const fromRails = input.identityVerified
            ? railState(rails, featureNeeds(key, input.residence), actions)
            : { state: 'under-review' as const }
        if (key === 'card' && cardStep && fromRails.state !== 'available') return { key, state: cardStep }
        return { key, ...fromRails }
    })
}
