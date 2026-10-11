/**
 * Phase 3, pure rows: which one card holds the Home zone.
 *
 * Every expectation cites phase3-spec.md. New asks are looked up by id from
 * the registry (`ASKS`) so the rows do not depend on export names.
 */
import { decide } from '../decide'
import { ASKS } from '../registry'
import type { AskId, AttentionAsk, JourneyState, Ledger, Session, Verdict } from '../types'

const NOW = Date.parse('2026-10-11T12:00:00Z')

const onboarding = (step: 'verify' | 'add_money' | 'first_payment' | 'completed') => ({
    verify: step === 'verify' ? ('todo' as const) : ('done' as const),
    addMoneyDone: step !== 'verify' && step !== 'add_money',
    firstPaymentDone: step === 'completed',
    firstPaymentRoute: 'card_qr' as const,
    step,
})

type Loose = Record<string, unknown>

const CARD_OFFER_QUIET = { loaded: true, geoProhibited: false, hasCardRelationship: true, promotionDisabled: false }

/** An activated user with nothing to show: each row turns one card on. */
const baseState: Loose = {
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
    onboarding: onboarding('completed'),
    blockedCardId: null,
    dueTasks: 0,
    card: { loaded: true, needsSetup: false, activeCardId: null },
    postAuthRedirect: false,
    postAuthRedirectDestination: null,
    balance: { loaded: true, usd: 0 },
    migration: { on: false },
    push: { ready: true, unanswered: false, promptedThisSession: false, notEnabled: false },
    showEarlyUserModal: false,
    // phase 3 journey fields
    activated: true,
    geoCountry: 'US',
    invitesSent: 1,
    hasSupportSurvivorBadge: true,
    cardOffer: CARD_OFFER_QUIET,
    qr: { canPayNow: false, hasMadeQrPayment: false, verifyOpensQr: false },
    documentSlideKey: null,
    flags: { userInterview: false },
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

const stateOf = (patch: Loose = {}) => ({ ...baseState, ...patch }) as unknown as JourneyState

const run = (patch: Loose = {}, session: Partial<Session> = {}, ledger: Loose = {}) =>
    decide(stateOf(patch), ASKS, ledger as Ledger, { ...baseSession, ...session })

const id = (value: string) => value as AskId
const askById = (value: string): AttentionAsk | undefined => ASKS.find((ask) => ask.id === value)
const verdictOf = (ask: string, patch: Loose) => run(patch).trace.verdicts[id(ask)]

const PUSH_UNANSWERED = { ready: true, unanswered: true, promptedThisSession: false, notEnabled: true }
const CARD_OFFER_OPEN = { loaded: true, geoProhibited: false, hasCardRelationship: false, promotionDisabled: false }
const QR_PAY_NOW = { canPayNow: true, hasMadeQrPayment: false, verifyOpensQr: false }
// the showVerifyCTA rule (QR a path but not open, unverified, idle, not card-eligible) is folded into verifyOpensQr by journeyState.ts
const QR_LOCKED = { canPayNow: false, hasMadeQrPayment: false, verifyOpensQr: true }

describe('registry: the zone asks follow the approved ranked list', () => {
    // spec §2 table: "Ask id | Tier · rank | Surfaces"
    test.each([
        ['verification-due', 1, 3, ['zone']],
        ['blocked-card', 2, 2, ['zone']],
        ['checklist', 2, 3, ['zone']],
        ['install-app', 2, 1, ['interrupt', 'zone']],
        ['verification-advisory', 3, 0, ['zone']],
        ['qr-payment', 3, 2, ['zone']],
        ['verify-for-qr', 3, 3, ['zone']],
        ['card-offer', 3, 4, ['zone']],
        ['push-home-fallback', 4, 1, ['interrupt', 'zone']],
        ['invite', 5, 1, ['zone']],
        ['bug-bounty', 5, 5, ['zone']],
        ['user-interview', 5, 0, ['zone']],
    ])('%s is T%i · %i with surfaces %j', (askId, tier, rank, surfaces) => {
        const ask = askById(askId)
        expect(ask).toBeDefined()
        expect(ask?.tier).toBe(tier)
        expect(ask?.rank).toBe(rank)
        expect([...(ask?.surfaces ?? [])].sort()).toEqual([...surfaces].sort())
    })
})

describe('the ranked order among activated-user cards', () => {
    // "Tiers and ranks follow the approved list"; candidates are "in priority order" (DecisionTrace)
    const everyCard = {
        documentSlideKey: 'doc-request:proof-of-address',
        cardOffer: CARD_OFFER_OPEN,
        push: PUSH_UNANSWERED,
        invitesSent: 0,
        hasSupportSurvivorBadge: false,
        flags: { userInterview: true },
    }

    test('QR open: candidates in tier-then-rank order, the zone is the advisory', () => {
        const d = run({ ...everyCard, qr: QR_PAY_NOW })
        expect(d.trace.candidates).toEqual([
            'verification-advisory',
            'qr-payment',
            'card-offer',
            'push-home-fallback',
            'user-interview',
            'invite',
            'bug-bounty',
        ])
        expect(d.zone).toEqual({ id: 'verification-advisory', mode: 'ask' })
    })

    test('QR a path but locked: verify-for-qr takes qr-payment’s place in the order', () => {
        // qr-payment and verify-for-qr are mutually exclusive on `qr.canPayNow`, so the two run separately
        const d = run({ ...everyCard, qr: QR_LOCKED })
        expect(d.trace.candidates).toEqual([
            'verification-advisory',
            'verify-for-qr',
            'card-offer',
            'push-home-fallback',
            'user-interview',
            'invite',
            'bug-bounty',
        ])
        expect(d.zone).toEqual({ id: 'verification-advisory', mode: 'ask' })
    })
})

/** `not-show`: done or ineligible; `not-yet`: anything but show (the spec does not say whether loading is unknown) */
type Expect = 'show' | 'not-show' | 'not-yet' | Verdict

describe('each card’s eligibility rule', () => {
    test.each<[string, string, Loose, Expect]>([
        // verification-advisory: "an advisory (future-dated) document request exists before its final week (documentSlide)"
        ['verification-advisory', 'a document slide exists', { documentSlideKey: 'doc-request:poa' }, 'show'],
        ['verification-advisory', 'no document slide', { documentSlideKey: null }, 'not-show'],

        // qr-payment: "QR gate is proceed_to_pay and hasMadeQrPayment === false (undefined = unknown)"
        ['qr-payment', 'can pay now, never paid', { qr: QR_PAY_NOW }, 'show'],
        ['qr-payment', 'already paid a QR', { qr: { ...QR_PAY_NOW, hasMadeQrPayment: true } }, 'not-show'],
        ['qr-payment', 'history still loading', { qr: { ...QR_PAY_NOW, hasMadeQrPayment: undefined } }, 'unknown'],
        ['qr-payment', 'QR not open', { qr: QR_LOCKED }, 'not-show'],

        // verify-for-qr: "QR is a path but not open, identity not verified, no rail in flight, card-eligible is false"
        // (journeyState.ts folds that rule into qr.verifyOpensQr via showVerifyCTA; its inputs are tested in home-carousel.utils.test.ts)
        ['verify-for-qr', 'QR locked, unverified, idle', { qr: QR_LOCKED }, 'show'],
        ['verify-for-qr', 'QR already open', { qr: QR_PAY_NOW }, 'not-show'],
        ['verify-for-qr', 'verifying would not open QR', { qr: { ...QR_LOCKED, verifyOpensQr: false } }, 'not-show'],

        // card-offer: "activated, cardInfo loaded, not geo-prohibited, no card-channel rail"
        ['card-offer', 'open offer', { cardOffer: CARD_OFFER_OPEN }, 'show'],
        ['card-offer', 'geo-prohibited', { cardOffer: { ...CARD_OFFER_OPEN, geoProhibited: true } }, 'ineligible'],
        [
            'card-offer',
            'has a card relationship',
            { cardOffer: { ...CARD_OFFER_OPEN, hasCardRelationship: true } },
            'not-show',
        ],
        ['card-offer', 'card info not loaded', { cardOffer: { ...CARD_OFFER_OPEN, loaded: false } }, 'not-yet'],
        [
            'card-offer',
            'not activated',
            { cardOffer: CARD_OFFER_OPEN, activated: false, onboarding: onboarding('first_payment') },
            'not-show',
        ],

        // push-home-fallback: "on native when OneSignal is ready and push is not granted and not opted in"
        ['push-home-fallback', 'native, ready, unanswered', { push: PUSH_UNANSWERED }, 'show'],
        ['push-home-fallback', 'OneSignal not ready', { push: { ...PUSH_UNANSWERED, ready: false } }, 'unknown'],

        // invite: "activated and no invites sent"
        ['invite', 'activated, no invites', { invitesSent: 0 }, 'show'],
        ['invite', 'one invite sent', { invitesSent: 1 }, 'ineligible'],
        [
            'invite',
            'not activated',
            { invitesSent: 0, activated: false, onboarding: onboarding('first_payment') },
            'not-show',
        ],
        // "copy variant by geo (AR/BR = LatAm cashback copy)": one ask, eligible in both geos
        ['invite', 'LatAm user', { invitesSent: 0, geoCountry: 'AR' }, 'show'],

        // bug-bounty: "activated and no SUPPORT_SURVIVOR badge"
        ['bug-bounty', 'no badge', { hasSupportSurvivorBadge: false }, 'show'],
        ['bug-bounty', 'badge earned', { hasSupportSurvivorBadge: true }, 'not-show'],
        [
            'bug-bounty',
            'not activated',
            { hasSupportSurvivorBadge: false, activated: false, onboarding: onboarding('first_payment') },
            'not-show',
        ],

        // user-interview: "PostHog flag user-interviews-invite"
        ['user-interview', 'flag on', { flags: { userInterview: true } }, 'show'],
        ['user-interview', 'flag off', { flags: { userInterview: false } }, 'ineligible'],

        // install-app: "web + migration.on"
        ['install-app', 'web, migration on', { isNative: false, migration: { on: true } }, 'show'],
        ['install-app', 'native', { isNative: true, migration: { on: true } }, 'not-show'],
    ])('%s — %s', (ask, _label, patch, expected) => {
        const verdict = verdictOf(ask, patch)
        expect(verdict).toBeDefined()
        if (expected === 'not-show') expect(['done', 'ineligible']).toContain(verdict)
        else if (expected === 'not-yet') expect(verdict).not.toBe('show')
        else expect(verdict).toBe(expected)
    })

    test('the push zone card is native only', () => {
        // "the zone card appears on native when OneSignal is ready and push is not granted and not opted in"
        expect(run({ push: PUSH_UNANSWERED }).zone).toEqual({ id: 'push-home-fallback', mode: 'ask' })
        expect(run({ push: PUSH_UNANSWERED, isNative: false }).zone?.id).not.toBe('push-home-fallback')
    })
})

describe('no flash of a lower card while a higher one loads', () => {
    // "decide() holds the zone (returns zone: null) while any ask with a zone surface in a higher tier
    //  than the best live candidate is still unknown, until the 4 s settle deadline"
    const inviteOnly = { invitesSent: 0 }

    test('the checklist is unknown: the invite card waits, then releases at the deadline', () => {
        const loading = { ...inviteOnly, onboarding: null }
        expect(run(loading).trace.verdicts.checklist).toBe('unknown')
        expect(run(loading).zone).toBeNull()
        expect(run(loading, { settleDeadlinePassed: true }).zone).toEqual({ id: 'invite', mode: 'ask' })
    })

    test('history never loads (qr-payment unknown): the invite card releases at the deadline', () => {
        // failure #6: "history (for hasMadeQrPayment) never loads → unknown releases at the settle deadline"
        const loading = { ...inviteOnly, qr: { ...QR_PAY_NOW, hasMadeQrPayment: undefined } }
        expect(run(loading).zone).toBeNull()
        expect(run(loading, { settleDeadlinePassed: true }).zone).toEqual({ id: 'invite', mode: 'ask' })
    })

    test('a lower-tier unknown never holds a higher card', () => {
        // "in a higher tier than the best live candidate": the checklist (T2) is above qr-payment (T3)
        const d = run({
            activated: false,
            onboarding: onboarding('verify'),
            qr: { ...QR_PAY_NOW, hasMadeQrPayment: undefined },
        })
        expect(d.zone).toEqual({ id: 'checklist', mode: 'ask' })
    })

    test('an unknown interrupt-only ask does not hold the zone', () => {
        // "any ask with a zone surface": updated terms has none
        const d = run({ ...inviteOnly, consent: { status: 'unknown', versions: [], documents: [] } })
        expect(d.zone).toEqual({ id: 'invite', mode: 'ask' })
    })
})

describe('rotation', () => {
    // "for tier ≥ 3, a card whose consecutiveSessions ≥ policy.maxConsecutiveSessions (default 3) and whose
    //  lastSessionShown === session.count − 1 is skipped for this session"
    const session = { count: 5 }
    const resting = { lastSessionShown: 4, consecutiveSessions: 3 }
    const twoCards = { invitesSent: 0, hasSupportSurvivorBadge: false }

    test('a card that held the zone 3 sessions in a row yields to the next candidate', () => {
        expect(run(twoCards, session).zone).toEqual({ id: 'invite', mode: 'ask' })
        expect(run(twoCards, session, { invite: resting }).zone).toEqual({ id: 'bug-bounty', mode: 'ask' })
    })

    test('a gap session or a shorter run does not rest it', () => {
        expect(run(twoCards, session, { invite: { ...resting, lastSessionShown: 3 } }).zone?.id).toBe('invite')
        expect(run(twoCards, session, { invite: { ...resting, consecutiveSessions: 2 } }).zone?.id).toBe('invite')
    })

    test('every candidate resting: the top one shows anyway, never an empty zone', () => {
        // "if every candidate is resting, the top one shows anyway"; failure #10
        const d = run(twoCards, session, { invite: resting, 'bug-bounty': resting })
        expect(d.zone).toEqual({ id: 'invite', mode: 'ask' })
    })

    test('T1 and T2 never rotate: the checklist stays while a fresh T5 card waits', () => {
        // "T1 and T2 never rotate"; failure #11
        const d = run({ activated: false, onboarding: onboarding('verify'), flags: { userInterview: true } }, session, {
            checklist: resting,
        })
        expect(d.trace.candidates).toContain('user-interview')
        expect(d.zone).toEqual({ id: 'checklist', mode: 'ask' })
    })
})

describe('the push ask in the zone', () => {
    const pushOnly = { push: PUSH_UNANSWERED }

    test('takes the zone when its interrupt is refused by budget', () => {
        // "install-app and the push ask gain a zone surface"; session budget: none after a T1
        const d = run(pushOnly, { count: 3, interruptsThisSession: ['legal-reconsent'] })
        expect(d.interrupt).toBeNull()
        expect(d.trace.reasons['push-home-fallback']).toMatch(/T1 interrupt already fired/)
        expect(d.zone).toEqual({ id: 'push-home-fallback', mode: 'ask' })
    })

    test('never takes both: when it interrupts, the zone is not the push card', () => {
        // "interrupt and zone never show the same ask"
        const d = run(pushOnly, { count: 3 })
        expect(d.interrupt).toBe('push-home-fallback')
        expect(d.zone?.id).not.toBe('push-home-fallback')
    })

    test('install-app interrupts and the checklist keeps the zone', () => {
        // "interrupt and zone never show the same ask" (install-app is T2 · 1 on both surfaces)
        const d = run({ isNative: false, migration: { on: true }, activated: false, onboarding: onboarding('verify') })
        expect(d.interrupt).toBe('install-app')
        expect(d.zone).toEqual({ id: 'checklist', mode: 'ask' })
    })
})
