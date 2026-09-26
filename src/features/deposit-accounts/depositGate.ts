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
    /** the provider's review of this corridor waits on the user; the hosted check clears it */
    | 'finish-review'
    /** the same block, where the app has no way to start the hosted check: a person does */
    | 'finish-review-support'
    /**
     * A verified user whose own review for this corridor waits on them
     * (backend `cause: 'review-action'`). The capability gate's action clears
     * it, but its words are the identity ones, which are false here.
     */
    | 'provider-review'
    | 'none'

/** The reasons the BACKEND gives, beside the ones the capability gate gives. */
type DepositBlock = NonNullable<ClaimableCorridor['blockedBy']>

const DEPOSIT_BLOCKS: ReadonlySet<string> = new Set<DepositBlock>([
    'account-limit',
    'endorsement-pending',
    'endorsement-required',
])

/** Did the backend's terms produce this notice, rather than the capability gate? */
export function isDepositBlock(kind: GateState['kind'] | DepositBlock): kind is DepositBlock {
    return DEPOSIT_BLOCKS.has(kind)
}

/**
 * Gate kinds where verification is a step THIS user can actually take.
 *
 * `needs-identity` is the obvious one and used to be the only one the rows
 * asked about. It is not the answer a real unverified user gets: their rails
 * come back `requires-info` with a `sumsub:identity` action on them, and the
 * resolver answers `fixable-rejection` — a concrete action, with the
 * provider's own sentence attached. The rows read neither, so four corridors
 * said "Not set up" on a disabled row while the screen behind them was ready
 * to say "Verify your identity first" and open the flow that clears it.
 *
 * `needs-enrollment` is deliberately absent. There the user IS verified and
 * simply has no rail for this corridor, so sending them to verification again
 * cannot open it — that row is correctly closed. `blocked-rejection` is absent
 * for the opposite reason: it is terminal, and only a person can lift it.
 */
const OFFERS_VERIFICATION: ReadonlySet<GateState['kind']> = new Set<GateState['kind']>([
    'needs-identity',
    'fixable-rejection',
    'restart-identity',
])

/** Does this gate name a verification step the user can take right now? */
export function offersVerification(gate: GateState | undefined): boolean {
    return !!gate && OFFERS_VERIFICATION.has(gate.kind)
}

/**
 * Gate kinds that only say "this user holds no working rail here yet".
 *
 * Two corridors are offered before the user has a rail: the tap asks the
 * provider for a review, and the rail arrives when the review passes. For those
 * the capability gate can never be `ready` first, so it must not answer first.
 * A verified user read `needs-enrollment` there and was sent to identity
 * verification, which cannot grant a provider review. Once the tap recorded the
 * request the gate read `pending`, and the screen said "nothing for you to do"
 * while the backend reported a review waiting on the user.
 *
 * `needs-identity` is deliberately absent: a user who has not verified is told
 * that first.
 */
const NO_RAIL_YET: ReadonlySet<GateState['kind']> = new Set(['needs-enrollment', 'pending', 'waiting-on-provider'])

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

const ACTION_BY_BLOCK: Record<DepositBlock, DepositGateAction> = {
    'account-limit': 'account-limit',
    'endorsement-pending': 'pending-review',
    'endorsement-required': 'finish-review',
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
 * The capability gate cannot know about any of them: the account cap is a
 * billing decision, and a provider review is a queue at the provider. A review
 * that waits on the USER is its own kind. The user is already verified, and
 * identity verification cannot grant the review, so it never reuses that flow.
 */
function blockNotice(blockedBy: DepositBlock): DepositGateView {
    return { claimable: false, notice: { kind: blockedBy, message: null, action: ACTION_BY_BLOCK[blockedBy] } }
}

/**
 * `loading` blocks without shouting: a banner on first paint is noise, and the
 * rows come alive on their own a moment later.
 *
 * The capability gate is asked first. A user who has not verified is not told
 * about an account cap they are nowhere near, and a corridor is never blocked
 * for two reasons at once. The one exception is a corridor the backend offers
 * while the gate only says "no rail yet" — see `NO_RAIL_YET`.
 */
export function depositGateView(gate: GateState, claimable?: ClaimableCorridor): DepositGateView {
    if (gate.kind === 'loading') return { claimable: false }
    if (gate.kind === 'ready' || (claimable && NO_RAIL_YET.has(gate.kind))) {
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
