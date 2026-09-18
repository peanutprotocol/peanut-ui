import type { GateState } from '@/utils/capability-gate'
import type { ClaimableCorridor } from './types'

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
type DepositGateAction =
    | 'verify'
    | 'accept-tos'
    | 'provide-email'
    | 'support'
    /** the user holds as many accounts as we open by default — support opens another */
    | 'account-limit'
    /** the provider is reviewing this corridor; the screen waits and continues by itself */
    | 'pending-review'
    | 'none'

/** The reasons the BACKEND gives, beside the ones the capability gate gives. */
type DepositBlock = NonNullable<ClaimableCorridor['blockedBy']>

export interface DepositGateView {
    /** rows are tappable */
    claimable: boolean
    /** the banner above the list, when there is something to say */
    notice?: {
        kind: GateState['kind'] | DepositBlock
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
    // an already-verified user whose email never reached the provider. Sumsub
    // cannot clear it; the email sheet can, and sending them to Sumsub instead
    // burns an attempt and leaves the rail exactly as blocked as it was.
    'provide-email': 'provide-email',
    // terminal: re-verifying cannot clear it, so do not offer to
    'blocked-rejection': 'support',
}

/**
 * The block the backend put on this corridor, as the same notice shape.
 *
 * Two of them exist that the capability gate cannot know about: the account
 * cap, which is a billing decision, and a provider review that has been asked
 * for and not yet answered. A review waiting on the USER is not a third thing
 * — it is identity verification, so it reuses the kind and the copy that
 * already exist for it rather than inventing a parallel screen.
 */
function blockNotice(blockedBy: DepositBlock): DepositGateView {
    if (blockedBy === 'endorsement-required') {
        return { claimable: false, notice: { kind: 'needs-identity', message: null, action: 'verify' } }
    }
    return {
        claimable: false,
        notice: {
            kind: blockedBy,
            message: null,
            action: blockedBy === 'account-limit' ? 'account-limit' : 'pending-review',
        },
    }
}

/**
 * `loading` blocks without shouting: a banner on first paint is noise, and the
 * rows come alive on their own a moment later.
 *
 * The capability gate is asked first. A user who has not verified is not told
 * about an account cap they are nowhere near, and a corridor is never blocked
 * for two reasons at once.
 */
export function depositGateView(gate: GateState, claimable?: ClaimableCorridor): DepositGateView {
    if (gate.kind === 'loading') return { claimable: false }
    if (gate.kind === 'ready') {
        return claimable?.blockedBy ? blockNotice(claimable.blockedBy) : { claimable: true }
    }

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
