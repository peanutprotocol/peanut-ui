import { RESIDENCE_ADDRESS_ACTION_KEY, RESIDENCE_ADDRESS_REJECTED_PURPOSE } from '@/constants/kyc.consts'
import type { GateState } from '@/utils/capability-gate'
import type { UnavailableCorridor } from './types'

export type AddressStepState = 'required' | 'rejected' | 'in_review'

/**
 * Where a corridor stands on the address step (api TASK-24662): the backend
 * withholds it because no residence is approved and Sumsub holds no address to
 * approve one from. The corridor's `cause` says so; the capability gate carries
 * the step itself, and its purpose says whether Sumsub refused the last answer.
 * Null for every other corridor, a residence the backend refuses included.
 */
export function addressStepOf(
    withheld: UnavailableCorridor | undefined,
    gate: GateState | undefined
): AddressStepState | null {
    if (withheld?.cause === 'address-in-review') return 'in_review'
    if (withheld?.cause !== 'address-required') return null
    return gate?.kind === 'fixable-rejection' && gate.nextAction?.purpose === RESIDENCE_ADDRESS_REJECTED_PURPOSE
        ? 'rejected'
        : 'required'
}

/** The gate starts the address step itself, with no other step in front of it. */
export const isAddressStepGate = (gate: GateState | undefined): boolean =>
    gate?.kind === 'fixable-rejection' && gate.actionKey === RESIDENCE_ADDRESS_ACTION_KEY
