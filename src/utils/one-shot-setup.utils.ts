import { KYC_INTENT_KEYS, type KycIntentKey, type KycIntentSet } from '@/services/kyc-intents'
import type { NextAction, RailCapability, RailOperation, UserCapabilities } from '@/types/capabilities'
import { railVerdict } from '@/utils/capability-gate'

/**
 * A row's state on the one-shot setup drawer (TASK-23329). Item 9a has three.
 * Item 9b adds the states a user acts on (a photo to retake, a document,
 * agreements, an ID issued by the residence country): one member here, one
 * branch on the rail verdict in `railState`, one badge on the drawer.
 */
export type SetupRowState = 'setting-up' | 'available' | 'under-review'

export interface SetupRow {
    key: KycIntentKey
    state: SetupRowState
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

function railState(
    rails: RailCapability[],
    needs: ReturnType<typeof featureNeeds>,
    actions: Map<string, NextAction>
): SetupRowState {
    const works = (rail: RailCapability) => (rail.operations?.[needs.operation] ?? rail.status) === 'enabled'
    if (needs.rails.every((serves) => rails.some((rail) => serves(rail) && works(rail)))) return 'available'
    // the verdict's wait marker: a provider holds the dossier and is deciding
    const waitsOnProvider = (rail: RailCapability) => {
        const verdict = railVerdict(rail, actions)
        return verdict.status === 'pending' && verdict.nextAction?.kind === 'wait'
    }
    const own = rails.filter((rail) => needs.rails.some((serves) => serves(rail)))
    // no rail yet, provisioning, or a verdict item 9b gives its own state
    return own.some(waitsOnProvider) ? 'under-review' : 'setting-up'
}

/**
 * One row per ticked feature, in checklist order. Until the identity is
 * verified no rail says anything yet, so every row waits on that one check.
 *
 * @param input.residence ISO-2 declared residence: the country of the local bank transfers
 */
export function setupRows(input: {
    intents: KycIntentSet
    residence: string
    capabilities: UserCapabilities | undefined
    identityVerified: boolean
}): SetupRow[] {
    const { rails = [], nextActions = [] } = input.capabilities ?? {}
    const actions = new Map(nextActions.map((action) => [action.key, action]))
    return KYC_INTENT_KEYS.filter((key) => input.intents[key]).map((key) => ({
        key,
        state: input.identityVerified ? railState(rails, featureNeeds(key, input.residence), actions) : 'under-review',
    }))
}
