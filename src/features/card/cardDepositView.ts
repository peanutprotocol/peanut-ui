/**
 * What the card drawer's deposit view may show (TASK-25169). One rule, owned here: the deposit address
 * shows only when the API answered that nothing is on its way to it and every outcome it reported has
 * been cleared against a fresh balance read. Anything the drawer does not positively know is a loading
 * or a retry state, never the address: a second send is the money risk.
 */
export type CardDepositView =
    /** the address, its status or a clear (with its fresh balance read) is still on its way */
    | 'loading'
    /** no address could be opened */
    | 'address-error'
    /** the status could not be read, or an earlier outcome could not be cleared against a fresh balance */
    | 'check-failed'
    /** the provider returned the deposit (market moved) */
    | 'failed'
    /** a deposit is on its way, or reported and not yet in the balance */
    | 'processing'
    /** the gap is covered */
    | 'done'
    | 'address'

export type DepositStatus = 'not_started' | 'loading' | 'failed' | 'completed'

export function cardDepositView(state: {
    addressLoading: boolean
    addressError: boolean
    /** the API answered with a status for this address */
    statusRead: boolean
    /** the status read failed and no status is known */
    statusError: boolean
    status: DepositStatus
    /** the first answer for this address was taken in (in flight kept, an old outcome sent to clear) */
    checked: boolean
    /** an outcome is being cleared, with a fresh balance read when it was a completed deposit */
    clearing: boolean
    /** that clear or its balance read failed */
    clearFailed: boolean
    /** a reported deposit waits for the balance to rise */
    pending: boolean
    done: boolean
}): CardDepositView {
    if (state.addressLoading) return 'loading'
    if (state.addressError) return 'address-error'
    if (state.clearFailed) return 'check-failed'
    if (!state.statusRead) return state.statusError ? 'check-failed' : 'loading'
    if (!state.checked || state.clearing) return 'loading'
    if (state.status === 'failed') return 'failed'
    if (state.status === 'loading' || state.pending) return 'processing'
    if (state.done) return 'done'
    // a completed outcome not yet resolved or cleared: the poll stops on it, so no address yet
    if (state.status === 'completed') return 'loading'
    return 'address'
}
