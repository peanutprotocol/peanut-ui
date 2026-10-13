import type { KycFeatures } from '@/app/actions/types/kyc-workflow.types'
import type { NextAction, RailCapability, RailOperation, UserCapabilities } from '@/types/capabilities'
import { railVerdict } from '@/utils/capability-gate'
import { KYC_FEATURE_KEYS } from '@/utils/kyc-document-plan.utils'

export type KycFeatureKey = keyof KycFeatures

/** A row's state on the setup status drawer. One member here is one badge on the drawer. */
export type SetupRowState = 'setting-up' | 'available' | 'under-review'

export interface SetupRow {
    key: KycFeatureKey
    state: SetupRowState
}

type RailTest = (rail: RailCapability) => boolean

const bridgeAccount =
    (currency: string): RailTest =>
    (rail) =>
        rail.provider === 'bridge' && rail.channel === 'bank' && rail.currency === currency

/**
 * What a feature needs before it reads "Available": per test, one rail with
 * the operation enabled. QR pays through any Manteca rail. Local bank
 * transfers deposit to the Manteca account of the residence. The card pays
 * through Rain. The accounts need both the USD and the EUR Bridge account.
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
    const waitsOnProvider = (rail: RailCapability) => {
        const verdict = railVerdict(rail, actions)
        return verdict.status === 'pending' && verdict.nextAction?.kind === 'wait'
    }
    const own = rails.filter((rail) => needs.rails.some((serves) => serves(rail)))
    return own.some(waitsOnProvider) ? 'under-review' : 'setting-up'
}

/**
 * One row per feature saved on the document list, in its order. Until the
 * identity is verified no rail says anything yet, so every row waits on that
 * one check.
 *
 * @param input.residence ISO-2 residence: the country of the local bank transfers
 */
export function setupRows(input: {
    features: KycFeatures
    residence: string | null
    capabilities: UserCapabilities | undefined
    identityVerified: boolean
}): SetupRow[] {
    const { rails = [], nextActions = [] } = input.capabilities ?? {}
    const actions = new Map(nextActions.map((action) => [action.key, action]))
    return KYC_FEATURE_KEYS.filter((key) => input.features[key]).map((key) => ({
        key,
        state: input.identityVerified ? railState(rails, featureNeeds(key, input.residence), actions) : 'under-review',
    }))
}
