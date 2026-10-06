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

// The rails behind each feature and the operation that makes it usable: QR
// pays through any Manteca rail (the QR gate's own test), local bank transfers
// deposit to a first-party Manteca account, the card pays through Rain, and
// the USD and EUR accounts deposit through Bridge.
const FEATURE_RAILS: Record<KycIntentKey, { serves: (rail: RailCapability) => boolean; operation: RailOperation }> = {
    qr: { serves: (rail) => rail.provider === 'manteca', operation: 'pay' },
    local: { serves: (rail) => rail.provider === 'manteca' && rail.channel === 'bank', operation: 'deposit' },
    card: { serves: (rail) => rail.provider === 'rain', operation: 'pay' },
    bank: { serves: (rail) => rail.provider === 'bridge' && rail.channel === 'bank', operation: 'deposit' },
}

function railState(rails: RailCapability[], operation: RailOperation, actions: Map<string, NextAction>): SetupRowState {
    if (rails.some((rail) => (rail.operations?.[operation] ?? rail.status) === 'enabled')) return 'available'
    // the verdict's wait marker: a provider holds the dossier and is deciding
    const waitsOnProvider = (rail: RailCapability) => {
        const verdict = railVerdict(rail, actions)
        return verdict.status === 'pending' && verdict.nextAction?.kind === 'wait'
    }
    // no rail yet, provisioning, or a verdict item 9b gives its own state
    return rails.some(waitsOnProvider) ? 'under-review' : 'setting-up'
}

/**
 * One row per ticked feature, in checklist order. Until the identity is
 * verified no rail says anything yet, so every row waits on that one check.
 */
export function setupRows(input: {
    intents: KycIntentSet
    capabilities: UserCapabilities | undefined
    identityVerified: boolean
}): SetupRow[] {
    const { rails = [], nextActions = [] } = input.capabilities ?? {}
    const actions = new Map(nextActions.map((action) => [action.key, action]))
    return KYC_INTENT_KEYS.filter((key) => input.intents[key]).map((key) => {
        if (!input.identityVerified) return { key, state: 'under-review' }
        const { serves, operation } = FEATURE_RAILS[key]
        return { key, state: railState(rails.filter(serves), operation, actions) }
    })
}
