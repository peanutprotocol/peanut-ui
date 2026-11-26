/**
 * What the card drawer's deposit view may show (TASK-25169). One rule, owned here: the deposit address
 * shows only when the API's own answer (never one a clear wrote) says nothing is on its way to it, and a
 * fresh balance read, taken after that answer and after any earlier outcome was cleared, gives the ask.
 * A deposit seen on its way, or reported, holds processing until a fresh read shows the balance above
 * where it started. Anything not positively known is a loading or a retry state: a second send is the
 * money risk.
 */
export type CardDepositView =
    /** the address, its status, a clear or the fresh balance read is still on its way */
    | 'loading'
    /** no address could be opened */
    | 'address-error'
    /** the status or the fresh balance could not be read, or an earlier outcome could not be cleared */
    | 'check-failed'
    /** the provider returned the deposit (market moved) */
    | 'failed'
    /** a deposit is on its way, or reported and not yet in a fresh balance read */
    | 'processing'
    /** the gap is covered */
    | 'done'
    | 'address'

export type DepositStatus = 'not_started' | 'loading' | 'failed' | 'completed'

export function cardDepositView(state: {
    addressLoading: boolean
    addressError: boolean
    /** the API itself answered with a status for this address (a clear's own "not started" is not one) */
    statusRead: boolean
    /** the status read failed and no answer of the API's is known */
    statusError: boolean
    /** the latest status read failed: an answer from before may be out of date */
    statusFailing: boolean
    status: DepositStatus
    /** the first answer for this address was taken in, against a fresh balance read */
    checked: boolean
    /** a fresh balance read came back since the last clear */
    balanceFresh: boolean
    /** the fresh balance read failed */
    balanceReadFailed: boolean
    /** an earlier outcome is being cleared */
    clearing: boolean
    /** that clear failed */
    clearFailed: boolean
    /** a deposit seen on its way or reported, not yet in a fresh balance read */
    holding: boolean
    done: boolean
}): CardDepositView {
    if (state.addressLoading) return 'loading'
    if (state.addressError) return 'address-error'
    if (state.statusRead && state.status === 'failed') return 'failed'
    if (state.holding || (state.statusRead && state.status === 'loading')) return 'processing'
    // the gap is covered: nothing a later failing read says can undo that
    if (state.done) return 'done'
    // a poll that fails cannot see a deposit arrive: no address while it does
    if (state.clearFailed || state.balanceReadFailed || state.statusFailing) return 'check-failed'
    if (!state.statusRead) return state.statusError ? 'check-failed' : 'loading'
    if (!state.checked || state.clearing || !state.balanceFresh) return 'loading'
    // a completed outcome not yet resolved or cleared: the poll stops on it, so no address yet
    if (state.status === 'completed') return 'loading'
    return 'address'
}
