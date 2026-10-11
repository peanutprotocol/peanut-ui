/**
 * The manager's one rule: never two calls to action at once. Every collision
 * the app can produce is a row here, starting with the one that happened on
 * 2026-10-07: the updated-terms modal and the "Peanut is open to everyone"
 * drawer, both eligible in the same session.
 */
import { ANNOUNCEMENT_COOLDOWN_DAYS, decide, isSilenced } from '../decide'
import { ASKS, balanceBackup, legalReconsent } from '../registry'
import type { AttentionAsk, JourneyState, Ledger, Session } from '../types'

const DAY_MS = 24 * 60 * 60 * 1000
const NOW = Date.parse('2026-10-11T12:00:00Z')

const onboarding = (step: 'verify' | 'add_money' | 'first_payment' | 'completed') => ({
    verify: step === 'verify' ? ('todo' as const) : ('done' as const),
    addMoneyDone: step !== 'verify' && step !== 'add_money',
    firstPaymentDone: step === 'completed',
    firstPaymentRoute: 'card_qr' as const,
    step,
})

const baseState: JourneyState = {
    now: NOW,
    userId: 'user-a',
    userLoaded: true,
    isNative: true,
    route: 'home',
    consent: { status: 'clear', versions: [], documents: [] },
    identity: {
        status: 'not_started',
        isVerified: false,
        needsAction: false,
        isTerminalFailure: false,
        isRegionRestricted: false,
    },
    onboarding: onboarding('verify'),
    blockedCardId: null,
    dueTasks: 0,
    card: { loaded: true, needsSetup: false, activeCardId: null },
    postAuthRedirect: false,
    postAuthRedirectDestination: null,
    balance: { loaded: true, usd: 0 },
    migration: { on: false },
    push: { ready: true, unanswered: false, promptedThisSession: false, notEnabled: false },
    showEarlyUserModal: false,
    activated: false,
    geoCountry: null,
    invitesSent: 0,
    hasSupportSurvivorBadge: false,
    cardOffer: { loaded: true, geoProhibited: false, hasCardRelationship: false, promotionDisabled: false },
    qr: { canPayNow: false, hasMadeQrPayment: false, verifyOpensQr: false },
    documentSlideKey: null,
    flags: { userInterview: false },
    depositAccounts: { enabled: false, loaded: true, claimable: 0, active: 0 },
    lastSpendAt: null,
    hasReceivedRequestPayment: true,
    firstPeerPaymentAt: '2026-09-01T00:00:00.000Z',
    passkeyCount: null,
    hasEmail: true,
    hasFullName: true,
    rewardsPendingUsd: 0,
}

const baseSession: Session = {
    count: 1,
    route: 'home',
    interruptsThisSession: [],
    openInterrupt: null,
    busy: false,
    gateUp: false,
    settleDeadlinePassed: false,
}

const run = (state: Partial<JourneyState> = {}, session: Partial<Session> = {}, ledger: Ledger = {}) =>
    decide({ ...baseState, ...state }, ASKS, ledger, { ...baseSession, ...session })

const TERMS_NEEDED: Partial<JourneyState> = { consent: { status: 'needed', versions: ['2026-10-01'], documents: [] } }

describe('the 7 Oct incident: updated terms and the waitlist announcement', () => {
    const bothEligible: Partial<JourneyState> = { ...TERMS_NEEDED, showEarlyUserModal: true }

    test('1. consent still loading: nothing interrupts, the checklist holds the zone', () => {
        const d = run({ consent: { status: 'unknown', versions: [], documents: [] }, showEarlyUserModal: true })
        expect(d.interrupt).toBeNull()
        expect(d.zone).toEqual({ id: 'checklist', mode: 'ask' })
        expect(d.trace.reasons['early-user']).toBe('higher tier unsettled')
    })

    test('2. consent resolves: terms interrupts, the announcement waits', () => {
        const d = run(bothEligible)
        expect(d.interrupt).toBe('legal-reconsent')
        expect(d.zone).toEqual({ id: 'checklist', mode: 'ask' })
        expect(d.trace.candidates).toEqual(['legal-reconsent', 'checklist', 'early-user'])
    })

    test('3. "Not now" on terms: no second interrupt this session', () => {
        const snoozed: Ledger = { 'legal-reconsent': { snoozedUntil: new Date(NOW + 7 * DAY_MS).toISOString() } }
        const d = run(bothEligible, { interruptsThisSession: ['legal-reconsent'] }, snoozed)
        expect(d.interrupt).toBeNull()
        expect(d.trace.reasons['early-user']).toMatch(/one interrupt per session/)
    })

    test('4. a quiet later session: the announcement may open', () => {
        const d = run({ showEarlyUserModal: true, onboarding: onboarding('completed') }, { count: 3 })
        expect(d.interrupt).toBe('early-user')
        expect(d.zone).toBeNull()
    })

    test('4b. not before the third session, and not while the zone is busy', () => {
        expect(
            run({ showEarlyUserModal: true, onboarding: onboarding('completed') }, { count: 2 }).interrupt
        ).toBeNull()
        const busyZone = run({ showEarlyUserModal: true }, { count: 3 })
        expect(busyZone.interrupt).toBeNull()
        expect(busyZone.trace.reasons['early-user']).toBe('budget: zone not idle')
    })

    test('4c. announcements keep a cooldown between them', () => {
        const recent: Ledger = { 'early-user': { shownAt: [new Date(NOW - 2 * DAY_MS).toISOString()] } }
        const d = run({ showEarlyUserModal: true, onboarding: onboarding('completed') }, { count: 3 }, recent)
        expect(d.interrupt).toBeNull()
        expect(d.trace.reasons['early-user']).toBe('budget: cooldown')
        const old: Ledger = {
            'early-user': { shownAt: [new Date(NOW - (ANNOUNCEMENT_COOLDOWN_DAYS + 1) * DAY_MS).toISOString()] },
        }
        expect(
            run({ showEarlyUserModal: true, onboarding: onboarding('completed') }, { count: 3 }, old).interrupt
        ).toBe('early-user')
    })
})

describe('other pairs that collide today', () => {
    test('terms outranks the Home push ask, the balance warning and the download prompt', () => {
        const d = run({
            ...TERMS_NEEDED,
            push: { ready: true, unanswered: true, promptedThisSession: false, notEnabled: false },
            balance: { loaded: true, usd: 900 },
            isNative: false,
            migration: { on: true },
        })
        expect(d.interrupt).toBe('legal-reconsent')
    })

    test('a T1 ask may follow another T1 in the same session; a T4 may not', () => {
        const afterTerms = { interruptsThisSession: ['legal-reconsent' as const] }
        expect(run({ balance: { loaded: true, usd: 900 } }, afterTerms).interrupt).toBe('balance-backup')
        const push = run(
            { push: { ready: true, unanswered: true, promptedThisSession: false, notEnabled: false } },
            { ...afterTerms, count: 3 }
        )
        expect(push.interrupt).toBeNull()
        expect(push.trace.reasons['push-home-fallback']).toMatch(/T1 interrupt already fired/)
    })

    test('the download prompt (T2, budget session) takes one interrupt and the push ask waits', () => {
        const d = run(
            {
                isNative: false,
                migration: { on: true },
                push: { ready: true, unanswered: true, promptedThisSession: false, notEnabled: false },
            },
            { count: 3 }
        )
        expect(d.interrupt).toBe('install-app')
        expect(d.trace.reasons['push-home-fallback']).toBe('an interrupt is open')
    })

    test('the Home push ask waits for the third session, and stands down after a money-moment ask', () => {
        const state = { push: { ready: true, unanswered: true, promptedThisSession: false, notEnabled: false } }
        expect(run(state, { count: 2 }).interrupt).toBeNull()
        expect(run(state, { count: 3 }).interrupt).toBe('push-home-fallback')
        const asked = { push: { ready: true, unanswered: true, promptedThisSession: true, notEnabled: false } }
        expect(run(asked, { count: 3 }).trace.verdicts['push-home-fallback']).toBe('ineligible')
    })

    test('finish card setup needs an active card, so it never competes with verify', () => {
        // an active card implies the ID check passed: the checklist is already complete
        const d = run({
            card: { loaded: true, needsSetup: true, activeCardId: null },
            onboarding: onboarding('completed'),
        })
        expect(d.interrupt).toBe('finish-card-setup')
        expect(d.trace.verdicts.checklist).toBe('done')
    })

    test('post-verification action interrupts only once identity is verified', () => {
        const unverified = run({ postAuthRedirect: true })
        expect(unverified.interrupt).toBeNull()
        const verified = run({
            postAuthRedirect: true,
            postAuthRedirectDestination: '/claim/abc',
            identity: { ...baseState.identity, status: 'verified', isVerified: true },
        })
        expect(verified.interrupt).toBe('post-verification-action')
    })
})

describe('the zone', () => {
    test('a due verification task outranks the checklist', () => {
        expect(run({ dueTasks: 1 }).zone).toEqual({ id: 'verification-due', mode: 'ask' })
    })

    test('a blocked card replaces the checklist until hidden, and a new reason re-shows it', () => {
        const blocked = { blockedCardId: 'blocked-card:verification-issue:provider_rejected' }
        expect(run(blocked).zone).toEqual({ id: 'blocked-card', mode: 'ask' })
        const hidden: Ledger = {
            'blocked-card': { dismissedAt: new Date(NOW).toISOString(), version: blocked.blockedCardId },
        }
        expect(run(blocked, {}, hidden).zone).toEqual({ id: 'checklist', mode: 'ask' })
        expect(run({ blockedCardId: 'blocked-card:add-email:none' }, {}, hidden).zone).toEqual({
            id: 'blocked-card',
            mode: 'ask',
        })
    })

    test('only on Home', () => {
        expect(run({ route: 'other' }, { route: 'other' }).zone).toBeNull()
    })

    test('an interrupt never also takes the zone', () => {
        // no registered ask has both surfaces yet (phase 3 adds them), so the
        // rule is proved on a synthetic one that would otherwise win both
        const both: AttentionAsk = {
            id: 'legal-reconsent',
            tier: 1,
            rank: 0,
            surfaces: ['interrupt', 'zone'],
            eligible: () => 'show',
            policy: { routes: 'any' },
            analyticsKey: 'both',
        }
        const asks = [both, ...ASKS.filter((ask) => ask.id !== 'legal-reconsent')]
        const d = decide({ ...baseState, dueTasks: 1 }, asks, {}, baseSession)
        expect(d.interrupt).toBe('legal-reconsent')
        expect(d.zone).toEqual({ id: 'verification-due', mode: 'ask' })
    })
})

describe('session mechanics', () => {
    test('an open interrupt is sticky while it stays eligible', () => {
        const d = run({ ...TERMS_NEEDED, showEarlyUserModal: true }, { openInterrupt: 'early-user' })
        expect(d.interrupt).toBe('early-user')
        expect(d.trace.reasons['legal-reconsent']).toBe('an interrupt is open')
    })

    test('an open interrupt closes once its ask is no longer eligible', () => {
        const d = run({ showEarlyUserModal: false }, { openInterrupt: 'early-user' })
        expect(d.interrupt).toBeNull()
    })

    test('a user-opened overlay suspends the manager', () => {
        const d = run(TERMS_NEEDED, { busy: true })
        expect(d.suspended).toBe(true)
        expect(d.interrupt).toBeNull()
        expect(d.zone).toBeNull()
    })

    test('terms may interrupt off Home; the balance warning may not', () => {
        const off = { route: 'other' as const }
        expect(run({ ...TERMS_NEEDED, route: 'other' }, off).interrupt).toBe('legal-reconsent')
        const balance = run({ balance: { loaded: true, usd: 900 }, route: 'other' }, off)
        expect(balance.interrupt).toBeNull()
        expect(balance.trace.reasons['balance-backup']).toBe('route')
    })

    test('the settle deadline releases lower tiers held by an unknown', () => {
        const state: Partial<JourneyState> = {
            consent: { status: 'unknown', versions: [], documents: [] },
            showEarlyUserModal: true,
            onboarding: onboarding('completed'),
        }
        expect(run(state, { count: 3 }).interrupt).toBeNull()
        expect(run(state, { count: 3, settleDeadlinePassed: true }).interrupt).toBe('early-user')
    })

    test('logged out: nothing is eligible', () => {
        const d = run({ ...TERMS_NEEDED, userId: null, showEarlyUserModal: true })
        expect(d.trace.candidates).toEqual([])
    })
})

describe('isSilenced', () => {
    test('a snooze holds until its date, a dismissal with no expiry holds forever', () => {
        const state = { ...baseState, ...TERMS_NEEDED }
        expect(isSilenced(legalReconsent, { snoozedUntil: new Date(NOW + 1).toISOString() }, state)).toBe(true)
        expect(isSilenced(legalReconsent, { snoozedUntil: new Date(NOW - 1).toISOString() }, state)).toBe(false)
        expect(isSilenced(legalReconsent, { dismissedAt: new Date(NOW - 400 * DAY_MS).toISOString() }, state)).toBe(
            true
        )
    })

    test('a dismissal with an expiry re-arms', () => {
        const state = { ...baseState, balance: { loaded: true, usd: 900 } }
        expect(isSilenced(balanceBackup, { dismissedAt: new Date(NOW - 20 * DAY_MS).toISOString() }, state)).toBe(true)
        expect(isSilenced(balanceBackup, { dismissedAt: new Date(NOW - 22 * DAY_MS).toISOString() }, state)).toBe(false)
    })

    test('a new version re-arms a snoozed ask', () => {
        const state: JourneyState = {
            ...baseState,
            consent: { status: 'needed', versions: ['2026-11-01'], documents: [] },
        }
        const entry = { snoozedUntil: new Date(NOW + 30 * DAY_MS).toISOString(), version: '2026-10-01' }
        expect(isSilenced(legalReconsent, entry, state)).toBe(false)
    })
})
