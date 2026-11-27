import { RESIDENCE_ADDRESS_ACTION_KEY } from '@/constants/kyc.consts'
import type { GateState } from '@/utils/capability-gate'
import {
    actionStep,
    anyBankReady,
    bankRowState,
    cryptoWorksNow,
    isSelfStartedVerification,
    verifiedPageAccess,
    verifiedRow,
    type BankRowState,
} from '../verifiedRows'

describe('bankRowState', () => {
    const cases: [GateState, boolean, BankRowState][] = [
        [{ kind: 'ready' }, false, 'ready'],
        [{ kind: 'accept-tos', userMessage: null }, false, 'action'],
        [{ kind: 'fixable-rejection', userMessage: null, actionKey: RESIDENCE_ADDRESS_ACTION_KEY }, false, 'action'],
        [{ kind: 'provide-email', userMessage: null }, false, 'action'],
        [{ kind: 'blocked-rejection', userMessage: null }, false, 'refused'],
        [{ kind: 'waiting-on-provider', userMessage: null }, false, 'review'],
        // the account is still opening: it loads in place, then reads as under review
        [{ kind: 'pending' }, false, 'loading'],
        [{ kind: 'pending' }, true, 'review'],
        // not read yet: loading, then the row opens the bank hub
        [{ kind: 'loading' }, false, 'loading'],
        [{ kind: 'needs-enrollment' }, false, 'loading'],
        [{ kind: 'needs-enrollment' }, true, 'open'],
    ]
    it.each(cases)('%o (settled %s) is %s', (gate, settled, expected) => {
        expect(bankRowState(gate, settled)).toBe(expected)
    })
})

describe('verifiedRow', () => {
    const none = { rails: [], nextActions: [] }
    it('loads until the report arrives', () => {
        expect(verifiedRow(undefined, none, false).state).toBe('loading')
    })
    it('reads the report entry: on, setting up, terms', () => {
        expect(verifiedRow({ state: 'on' }, none, false).state).toBe('ready')
        expect(verifiedRow({ state: 'setting_up' }, none, true).state).toBe('review')
        const tos = {
            rails: [],
            nextActions: [{ key: 'bridge-tos', kind: 'accept-tos' }],
        } as unknown as Parameters<typeof verifiedRow>[1]
        expect(verifiedRow({ state: 'action_required', action: 'bridge-tos' }, tos, false).state).toBe('action')
    })
    it('says refused only for a provider refusal, not for a residence', () => {
        const support = {
            rails: [],
            nextActions: [{ key: 'support', kind: 'contact-support' }],
        } as unknown as Parameters<typeof verifiedRow>[1]
        expect(verifiedRow({ state: 'refused', action: 'support' }, support, false).state).toBe('refused')
        expect(verifiedRow({ state: 'refused', reason: 'local_residence_unsupported' }, none, false).state).toBe('open')
    })
})

describe('actionStep', () => {
    it('names the terms and the address step, nothing else', () => {
        expect(actionStep({ kind: 'accept-tos', userMessage: null })).toBe('terms')
        expect(
            actionStep({ kind: 'fixable-rejection', userMessage: null, actionKey: RESIDENCE_ADDRESS_ACTION_KEY })
        ).toBe('address')
        expect(actionStep({ kind: 'fixable-rejection', userMessage: null, actionKey: 'other' })).toBeNull()
    })
})

describe('chip and crypto line', () => {
    it('checks the chip only once a bank account works', () => {
        expect(anyBankReady(['review', 'action'])).toBe(false)
        expect(anyBankReady(['review', 'ready'])).toBe(true)
    })
    it('says crypto works now only when no bank row can take money or is loading', () => {
        expect(cryptoWorksNow(['review', 'action'])).toBe(true)
        expect(cryptoWorksNow(['refused'])).toBe(true)
        expect(cryptoWorksNow(['review', 'loading'])).toBe(false)
        expect(cryptoWorksNow(['ready'])).toBe(false)
        expect(cryptoWorksNow(['open'])).toBe(false)
    })
})

describe('isSelfStartedVerification', () => {
    it('sends self-started checks to the page', () => {
        for (const source of ['signup', 'home', 'payment_methods', 'direct'] as const)
            expect(isSelfStartedVerification(source)).toBe(true)
    })
    it('returns task-started checks to their task', () => {
        for (const source of ['card', 'unlock_payments', 'guest_claim'] as const)
            expect(isSelfStartedVerification(source)).toBe(false)
        expect(isSelfStartedVerification(null)).toBe(false)
    })
})

describe('verifiedPageAccess', () => {
    it('shows the page only to a verified identity', () => {
        expect(verifiedPageAccess('verified', false)).toBe('show')
    })
    it('waits for the user read and for a check the read has not caught up with', () => {
        expect(verifiedPageAccess(undefined, false)).toBe('wait')
        expect(verifiedPageAccess('processing', false)).toBe('wait')
    })
    it('sends anyone else Home, and a check still processing after the wait', () => {
        for (const status of ['not_started', 'action_required', 'failed'] as const)
            expect(verifiedPageAccess(status, false)).toBe('leave')
        expect(verifiedPageAccess('processing', true)).toBe('leave')
    })
})
