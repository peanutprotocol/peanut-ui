import type { PixWithdrawDisplay, PixWithdrawSign } from '@/services/pix'

export type DepositWithIdSign = Extract<PixWithdrawSign, { kind: 'deposit-with-id' }>

/** The withdrawal the init opened: what the wallet signs, and what the review and the last step show. */
export interface OpenedWithdrawal {
    intentId: string
    display: PixWithdrawDisplay
    sign: DepositWithIdSign
}

/**
 * Confirm of a Pix withdrawal as one state.
 *
 * - `idle`: nothing is open; `error` is a refused init, after which Confirm may run again.
 * - `starting`: the init is in flight.
 * - `reconfirm`: the opened quote is worse than the reviewed one; nothing is signed until Confirm.
 * - `opened`: the ticket is open and the wallet is not signing: the sign request was off-contract,
 *   Rhino's quote expired, or a signature failed. `resignable`: that signature surely sent nothing
 *   and the one re-sign per ticket is unused.
 * - `signing`: the wallet signs; `resigned` when this is the one re-sign.
 * - `funded`: the deposit is mined. Avenia pays the Pix after it.
 * - `unconfirmed`: the deposit was sent and its receipt never came, so it may still land.
 *
 * Every state from `reconfirm` on holds the opened withdrawal: once the ticket is open only it can
 * be signed, because a second withdrawal could pay twice.
 */
export type WithdrawSubmitState =
    | { phase: 'idle'; error: string | null }
    | { phase: 'starting' }
    | { phase: 'reconfirm'; withdrawal: OpenedWithdrawal }
    | { phase: 'opened'; withdrawal: OpenedWithdrawal; error: string; resignable: boolean; resigned: boolean }
    | { phase: 'signing'; withdrawal: OpenedWithdrawal; resigned: boolean }
    | { phase: 'funded'; withdrawal: OpenedWithdrawal }
    | { phase: 'unconfirmed'; withdrawal: OpenedWithdrawal }

export type WithdrawSubmitPhase = WithdrawSubmitState['phase']

/**
 * What happened. The events from `starting` carry the opened withdrawal; from `reconfirm` and
 * `opened` the state already holds it.
 *
 * - `SENT_NOTHING`: a dismissed passkey or a reverted transaction; nothing left the wallet.
 * - `MAYBE_SENT`: any other signing failure; the deposit may have gone out.
 */
export type WithdrawSubmitEvent =
    | { type: 'SUBMIT' }
    | { type: 'INIT_REFUSED'; error: string }
    | { type: 'OFF_CONTRACT'; withdrawal: OpenedWithdrawal; error: string }
    | { type: 'QUOTE_MOVED'; withdrawal: OpenedWithdrawal }
    | { type: 'SIGN_START'; withdrawal: OpenedWithdrawal }
    | { type: 'QUOTE_EXPIRED'; withdrawal: OpenedWithdrawal; error: string }
    | { type: 'SENT_NOTHING'; error: string }
    | { type: 'MAYBE_SENT'; error: string }
    | { type: 'MINED' }
    | { type: 'NO_RECEIPT' }

export const INITIAL_WITHDRAW_SUBMIT: WithdrawSubmitState = { phase: 'idle', error: null }

/** The one transition table of a withdrawal's Confirm. An event a state does not take leaves it unchanged. */
export function withdrawSubmitReducer(state: WithdrawSubmitState, event: WithdrawSubmitEvent): WithdrawSubmitState {
    switch (state.phase) {
        case 'idle':
            return event.type === 'SUBMIT' ? { phase: 'starting' } : state
        case 'starting':
            switch (event.type) {
                case 'INIT_REFUSED':
                    return { phase: 'idle', error: event.error }
                case 'OFF_CONTRACT':
                    return {
                        phase: 'opened',
                        withdrawal: event.withdrawal,
                        error: event.error,
                        resignable: false,
                        resigned: false,
                    }
                case 'QUOTE_MOVED':
                    return { phase: 'reconfirm', withdrawal: event.withdrawal }
                case 'SIGN_START':
                    return { phase: 'signing', withdrawal: event.withdrawal, resigned: false }
                case 'QUOTE_EXPIRED':
                    return {
                        phase: 'opened',
                        withdrawal: event.withdrawal,
                        error: event.error,
                        resignable: false,
                        resigned: false,
                    }
                default:
                    return state
            }
        case 'reconfirm':
            switch (event.type) {
                case 'SIGN_START':
                    return { phase: 'signing', withdrawal: state.withdrawal, resigned: false }
                case 'QUOTE_EXPIRED':
                    return {
                        phase: 'opened',
                        withdrawal: state.withdrawal,
                        error: event.error,
                        resignable: false,
                        resigned: false,
                    }
                default:
                    return state
            }
        case 'opened':
            if (!state.resignable) return state
            switch (event.type) {
                case 'SIGN_START':
                    return { phase: 'signing', withdrawal: state.withdrawal, resigned: true }
                case 'QUOTE_EXPIRED':
                    return { ...state, error: event.error, resignable: false }
                default:
                    return state
            }
        case 'signing':
            switch (event.type) {
                case 'SENT_NOTHING':
                    return {
                        phase: 'opened',
                        withdrawal: state.withdrawal,
                        error: event.error,
                        resignable: !state.resigned,
                        resigned: state.resigned,
                    }
                case 'MAYBE_SENT':
                    return {
                        phase: 'opened',
                        withdrawal: state.withdrawal,
                        error: event.error,
                        resignable: false,
                        resigned: state.resigned,
                    }
                case 'MINED':
                    return { phase: 'funded', withdrawal: state.withdrawal }
                case 'NO_RECEIPT':
                    return { phase: 'unconfirmed', withdrawal: state.withdrawal }
                default:
                    return state
            }
        case 'funded':
        case 'unconfirmed':
            return state
    }
}

/** The opened withdrawal can be signed now: its quote moved and waits for Confirm, or its one re-sign is free. */
export function canSignOpened(state: WithdrawSubmitState): boolean {
    return state.phase === 'reconfirm' || (state.phase === 'opened' && state.resignable)
}

export function openedWithdrawal(state: WithdrawSubmitState): OpenedWithdrawal | null {
    return 'withdrawal' in state ? state.withdrawal : null
}
