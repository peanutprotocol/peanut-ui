import type { GateState } from '@/utils/capability-gate'

/**
 * What the corridor list does with the app's capability gate.
 *
 * Deposit accounts do not get their own idea of "is this user allowed yet".
 * `gateFor('deposit', { channel: 'bank', country })` already answers that for
 * every bank surface, and the answer carries the provider's own message and
 * the action that clears it. This maps that one primitive onto the two
 * questions this screen asks: may the user claim anything, and what do we say
 * if not.
 */
export interface DepositGateView {
    /** rows are tappable */
    claimable: boolean
    /** the banner above the list, when there is something to say */
    notice?: {
        /** the provider's own words, when it gave any */
        message: string | null
        /** the gate kind, so the caller wires the right action */
        kind: GateState['kind']
    }
}

/**
 * `loading` blocks without shouting: a spinner-shaped banner on first paint is
 * noise, and the rows come alive on their own a moment later.
 */
export function depositGateView(gate: GateState): DepositGateView {
    if (gate.kind === 'ready') return { claimable: true }
    if (gate.kind === 'loading') return { claimable: false }
    if (gate.kind === 'pending') return { claimable: false, notice: { message: null, kind: gate.kind } }
    return {
        claimable: false,
        notice: { message: 'userMessage' in gate ? gate.userMessage : null, kind: gate.kind },
    }
}
