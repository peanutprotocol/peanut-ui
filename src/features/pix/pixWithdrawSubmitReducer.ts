import type { PixWithdrawDisplay, PixWithdrawSign } from '@/services/pix'

/**
 * The withdrawal Confirm opened: what the wallet signs, and what the review and the last step show.
 * `intentId` is null while nothing is open at the provider: a `transfer-then-submit` withdrawal opens
 * only when its signed transfer is submitted.
 */
export interface OpenedWithdrawal {
    intentId: string | null
    display: PixWithdrawDisplay
    sign: PixWithdrawSign
}

/**
 * Confirm of a Pix withdrawal as one state.
 *
 * - `idle`: nothing is open; `error` is a refused init, or a withdrawal that opened nothing and
 *   sent nothing, after which Confirm may run again.
 * - `starting`: the init is in flight.
 * - `reconfirm`: the opened quote is worse than the reviewed one; nothing is signed until Confirm.
 * - `opened`: the withdrawal is open and the wallet is not signing: the sign request was
 *   off-contract, the quote expired, or a signature failed. `resignable`: that signature surely
 *   sent nothing and the one re-sign per withdrawal is unused.
 * - `signing`: the wallet signs (and, for `transfer-then-submit`, the API opens the order and
 *   broadcasts); `resigned` when this is the one re-sign.
 * - `funded`: the funding is mined, or the API broadcast the submitted transfer. The provider pays
 *   the Pix after it.
 * - `unconfirmed`: the funding was sent and its receipt never came, so it may still land.
 *
 * Every state from `reconfirm` on holds the opened withdrawal: once it is open at the provider only
 * it can be signed, because a second withdrawal could pay twice. One that opened nothing at the
 * provider (`intentId` null) goes back to `idle` when it surely sent nothing, so Confirm opens a new
 * one; when it may have sent, it stays held like any other.
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
 * - `SENT_NOTHING`: a dismissed passkey, a reverted transaction, or a submit the API refused before
 *   it broadcast; nothing left the wallet.
 * - `MAYBE_SENT`: any other failure; the funding may have gone out.
 * - `MINED`: the funding transaction is mined. `SUBMITTED`: the API opened the order and broadcast
 *   the signed transfer, and names the withdrawal when it can.
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
    | { type: 'SUBMITTED'; intentId: string | null }
    | { type: 'NO_RECEIPT' }

export const INITIAL_WITHDRAW_SUBMIT: WithdrawSubmitState = { phase: 'idle', error: null }

/** A withdrawal that stopped before it was signed: held when it is open at the provider, else gone. */
function stopped(withdrawal: OpenedWithdrawal, error: string): WithdrawSubmitState {
    if (withdrawal.intentId === null) return { phase: 'idle', error }
    return { phase: 'opened', withdrawal, error, resignable: false, resigned: false }
}

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
                case 'QUOTE_EXPIRED':
                    return stopped(event.withdrawal, event.error)
                case 'QUOTE_MOVED':
                    return { phase: 'reconfirm', withdrawal: event.withdrawal }
                case 'SIGN_START':
                    return { phase: 'signing', withdrawal: event.withdrawal, resigned: false }
                default:
                    return state
            }
        case 'reconfirm':
            switch (event.type) {
                case 'SIGN_START':
                    return { phase: 'signing', withdrawal: state.withdrawal, resigned: false }
                case 'QUOTE_EXPIRED':
                    return stopped(state.withdrawal, event.error)
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
                    // nothing open and nothing sent: Confirm opens a new withdrawal
                    if (state.withdrawal.intentId === null) return { phase: 'idle', error: event.error }
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
                case 'SUBMITTED':
                    return {
                        phase: 'funded',
                        withdrawal: { ...state.withdrawal, intentId: event.intentId ?? state.withdrawal.intentId },
                    }
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
