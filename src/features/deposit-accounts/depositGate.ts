import type { GateState } from '@/utils/capability-gate'

/**
 * What the corridor list does with the app's capability gate.
 *
 * Deposit accounts do not get their own idea of "is this user allowed yet".
 * `gateFor('deposit', { channel: 'bank', country })` already answers that for
 * every bank surface, and the answer carries the provider's own message and
 * the action that clears it.
 *
 * The gate kind decides what the banner offers, because the kinds are not
 * interchangeable: `pending` and `waiting-on-provider` have nothing for the
 * user to do, `accept-tos` needs a consent link, and a terminal rejection
 * needs support. Sending all of them to "Verify your identity" is how a
 * verified user ends up in a Sumsub run that cannot help them.
 */
export type DepositGateAction = 'verify' | 'accept-tos' | 'support' | 'none'

export interface DepositGateView {
    /** rows are tappable */
    claimable: boolean
    /** the banner above the list, when there is something to say */
    notice?: {
        kind: GateState['kind']
        /** the provider's own words, when it gave any */
        message: string | null
        /** what the button does, or `none` when the user can only wait */
        action: DepositGateAction
        /** the terms link, on the one kind that has one */
        tosUrl?: string
    }
}

const ACTION_BY_KIND: Record<GateState['kind'], DepositGateAction> = {
    loading: 'none',
    ready: 'none',
    // nothing for the user to do — ours in flight, or the provider reviewing
    pending: 'none',
    'waiting-on-provider': 'none',
    'accept-tos': 'accept-tos',
    'needs-identity': 'verify',
    'needs-enrollment': 'verify',
    'fixable-rejection': 'verify',
    'restart-identity': 'verify',
    'provide-email': 'verify',
    // terminal: re-verifying cannot clear it, so do not offer to
    'blocked-rejection': 'support',
}

/**
 * `loading` blocks without shouting: a banner on first paint is noise, and the
 * rows come alive on their own a moment later.
 */
export function depositGateView(gate: GateState): DepositGateView {
    if (gate.kind === 'ready') return { claimable: true }
    if (gate.kind === 'loading') return { claimable: false }

    return {
        claimable: false,
        notice: {
            kind: gate.kind,
            message: 'userMessage' in gate ? gate.userMessage : null,
            action: ACTION_BY_KIND[gate.kind],
            tosUrl: gate.kind === 'accept-tos' ? gate.tosUrl : undefined,
        },
    }
}
