/** @jest-environment jsdom */
import { RESIDENCE_ADDRESS_ACTION_KEY } from '@/constants/kyc.consts'
import type { GateState } from '@/utils/capability-gate'
import {
    actionStep,
    anyBankReady,
    bankRowState,
    cryptoWorksNow,
    isSelfStartedVerification,
    identityJustApproved,
    markIdentityApproved,
    returningFromRow,
    rowReturn,
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
        // not opened on approval: the API's settled answer, so the row opens it at once
        [{ kind: 'needs-enrollment' }, false, 'open'],
        [{ kind: 'needs-identity' }, false, 'loading'],
        [{ kind: 'needs-identity' }, true, 'open'],
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
        // what the API sends for an account not opened on approval (feature-report.ts: `ready`, `activate`)
        expect(verifiedRow({ state: 'ready', action: 'activate' }, none, false).state).toBe('open')
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
    it('stops waiting on a missing status once the wait is over', () => {
        expect(verifiedPageAccess(undefined, true)).toBe('leave')
    })
    it('waits on a stale read right after this tab saw the approval, then gives up', () => {
        for (const status of ['not_started', 'action_required'] as const) {
            expect(verifiedPageAccess(status, false, true)).toBe('wait')
            expect(verifiedPageAccess(status, true, true)).toBe('leave')
        }
    })
})

describe('the approval signal', () => {
    beforeEach(() => window.sessionStorage.clear())
    it('holds for two minutes after an approval, then lapses', () => {
        expect(identityJustApproved()).toBe(false)
        const now = jest.spyOn(Date, 'now').mockReturnValue(1_000_000)
        markIdentityApproved()
        expect(identityJustApproved()).toBe(true)
        now.mockReturnValue(1_000_000 + 2 * 60_000)
        expect(identityJustApproved()).toBe(false)
        now.mockRestore()
    })
})

describe('one visit', () => {
    beforeEach(() => window.sessionStorage.clear())
    const tokenOf = (path: string) => new URL(path, 'https://x').searchParams.get('visit')

    it('treats the way back from a row as the same visit, once', () => {
        const { path, token } = rowReturn('verified')
        expect(tokenOf(path)).toBe(token)
        expect(path).toMatch(/^\/verified\?visit=\d+$/)
        expect(returningFromRow(tokenOf(path))).toBe(true)
        // the same return path opened again is a new visit
        expect(returningFromRow(tokenOf(path))).toBe(false)
    })
    it('counts an opening without the token as a new visit, even after an abandoned row flow', () => {
        rowReturn('verified')
        // the row's flow was left for Home; the page is then opened directly
        expect(returningFromRow(null)).toBe(false)
    })
    it('keeps the bank-ready variant on the way back', () => {
        expect(rowReturn('bank-ready').path).toMatch(/^\/verified\?variant=bank-ready&visit=\d+$/)
    })
})
