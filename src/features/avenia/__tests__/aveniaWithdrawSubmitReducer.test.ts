import {
    canSignOpened,
    INITIAL_WITHDRAW_SUBMIT,
    openedWithdrawal,
    withdrawSubmitReducer,
    type OpenedWithdrawal,
    type WithdrawSubmitEvent,
    type WithdrawSubmitState,
} from '../aveniaWithdrawSubmitReducer'

const withdrawal = { intentId: 'w1' } as OpenedWithdrawal
const other = { intentId: 'w2' } as OpenedWithdrawal

const STATES: Record<string, WithdrawSubmitState> = {
    idle: INITIAL_WITHDRAW_SUBMIT,
    'idle after a refusal': { phase: 'idle', error: 'refused' },
    starting: { phase: 'starting' },
    reconfirm: { phase: 'reconfirm', withdrawal },
    'opened, re-sign free': { phase: 'opened', withdrawal, error: 'dismissed', resignable: true, resigned: false },
    'opened, no re-sign': { phase: 'opened', withdrawal, error: 'maybe sent', resignable: false, resigned: false },
    'opened, re-sign used': { phase: 'opened', withdrawal, error: 'dismissed', resignable: false, resigned: true },
    signing: { phase: 'signing', withdrawal, resigned: false },
    're-signing': { phase: 'signing', withdrawal, resigned: true },
    funded: { phase: 'funded', withdrawal },
    unconfirmed: { phase: 'unconfirmed', withdrawal },
}

// `other` on the events shows which withdrawal a state keeps: only `starting` takes it from the event
const EVENTS: Record<WithdrawSubmitEvent['type'], WithdrawSubmitEvent> = {
    SUBMIT: { type: 'SUBMIT' },
    INIT_REFUSED: { type: 'INIT_REFUSED', error: 'limit' },
    OFF_CONTRACT: { type: 'OFF_CONTRACT', withdrawal: other, error: 'off contract' },
    QUOTE_MOVED: { type: 'QUOTE_MOVED', withdrawal: other },
    SIGN_START: { type: 'SIGN_START', withdrawal: other },
    QUOTE_EXPIRED: { type: 'QUOTE_EXPIRED', withdrawal: other, error: 'expired' },
    SENT_NOTHING: { type: 'SENT_NOTHING', error: 'dismissed again' },
    MAYBE_SENT: { type: 'MAYBE_SENT', error: 'network' },
    MINED: { type: 'MINED' },
    NO_RECEIPT: { type: 'NO_RECEIPT' },
}

// Every transition. A (state, event) pair missing here must leave the state unchanged.
const TRANSITIONS: Partial<Record<string, Partial<Record<WithdrawSubmitEvent['type'], WithdrawSubmitState>>>> = {
    idle: { SUBMIT: { phase: 'starting' } },
    'idle after a refusal': { SUBMIT: { phase: 'starting' } },
    starting: {
        INIT_REFUSED: { phase: 'idle', error: 'limit' },
        OFF_CONTRACT: { phase: 'opened', withdrawal: other, error: 'off contract', resignable: false, resigned: false },
        QUOTE_MOVED: { phase: 'reconfirm', withdrawal: other },
        SIGN_START: { phase: 'signing', withdrawal: other, resigned: false },
        QUOTE_EXPIRED: { phase: 'opened', withdrawal: other, error: 'expired', resignable: false, resigned: false },
    },
    reconfirm: {
        SIGN_START: { phase: 'signing', withdrawal, resigned: false },
        QUOTE_EXPIRED: { phase: 'opened', withdrawal, error: 'expired', resignable: false, resigned: false },
    },
    'opened, re-sign free': {
        SIGN_START: { phase: 'signing', withdrawal, resigned: true },
        QUOTE_EXPIRED: { phase: 'opened', withdrawal, error: 'expired', resignable: false, resigned: false },
    },
    signing: {
        SENT_NOTHING: { phase: 'opened', withdrawal, error: 'dismissed again', resignable: true, resigned: false },
        MAYBE_SENT: { phase: 'opened', withdrawal, error: 'network', resignable: false, resigned: false },
        MINED: { phase: 'funded', withdrawal },
        NO_RECEIPT: { phase: 'unconfirmed', withdrawal },
    },
    're-signing': {
        // the one re-sign is spent: a second dismissal cannot open a third signature
        SENT_NOTHING: { phase: 'opened', withdrawal, error: 'dismissed again', resignable: false, resigned: true },
        MAYBE_SENT: { phase: 'opened', withdrawal, error: 'network', resignable: false, resigned: true },
        MINED: { phase: 'funded', withdrawal },
        NO_RECEIPT: { phase: 'unconfirmed', withdrawal },
    },
}

const CELLS = Object.keys(STATES).flatMap((state) =>
    (Object.keys(EVENTS) as WithdrawSubmitEvent['type'][]).map((event) => [state, event] as const)
)

describe('withdrawSubmitReducer', () => {
    it.each(CELLS)('%s + %s', (stateName, eventType) => {
        const state = STATES[stateName]
        const expected = TRANSITIONS[stateName]?.[eventType]
        const next = withdrawSubmitReducer(state, EVENTS[eventType])
        if (expected) expect(next).toEqual(expected)
        else expect(next).toBe(state)
    })

    it('holds the opened withdrawal in every state from the open ticket on, so nothing opens twice', () => {
        for (const [name, state] of Object.entries(STATES)) {
            const opened = !['idle', 'idle after a refusal', 'starting'].includes(name)
            expect(openedWithdrawal(state) !== null).toBe(opened)
        }
    })

    it('allows a signature of the open ticket only for a moved quote or a free re-sign', () => {
        const signable = Object.entries(STATES)
            .filter(([, state]) => canSignOpened(state))
            .map(([name]) => name)
        expect(signable).toEqual(['reconfirm', 'opened, re-sign free'])
    })
})
