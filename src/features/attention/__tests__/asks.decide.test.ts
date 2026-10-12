/**
 * Phase 4, pure rows: the missing asks.
 *
 * Every expectation cites phase4-spec.md. Asks are looked up by id from the
 * registry (`ASKS`) so the rows do not depend on export names.
 */
import { decide } from '../decide'
import { ASKS } from '../registry'
import type { AskId, AttentionAsk, JourneyState, Ledger, Session, Verdict } from '../types'

const NOW = Date.parse('2026-10-11T12:00:00Z')
const DAY_MS = 24 * 60 * 60 * 1000
const daysAgo = (days: number) => new Date(NOW - days * DAY_MS).toISOString()

const onboarding = (step: 'verify' | 'add_money' | 'first_payment' | 'completed') => ({
    verify: step === 'verify' ? ('todo' as const) : ('done' as const),
    addMoneyDone: step !== 'verify' && step !== 'add_money',
    firstPaymentDone: step === 'completed',
    firstPaymentRoute: 'card_qr' as const,
    step,
})

type Loose = Record<string, unknown>

const CARD_OFFER_QUIET = { loaded: true, geoProhibited: false, hasCardRelationship: true, promotionDisabled: false }
const DEPOSIT_QUIET = { enabled: false, loaded: true, claimable: 0, active: 0 }

/** An activated user with nothing to show: each row turns one card on. */
const baseState: Loose = {
    capNudge: null,
    maintenance: 'none',
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
    // phase 4 journey fields
    depositAccounts: DEPOSIT_QUIET,
    lastSpendAt: daysAgo(2),
    hasReceivedRequestPayment: true,
    firstPeerPaymentAt: daysAgo(30),
    passkeyCount: 2,
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
    slots: [],
}

const stateOf = (patch: Loose = {}) => ({ ...baseState, ...patch }) as unknown as JourneyState

const run = (patch: Loose = {}, session: Partial<Session> = {}, ledger: Loose = {}) =>
    decide(stateOf(patch), ASKS, ledger as Ledger, { ...baseSession, ...session })

const id = (value: string) => value as AskId
const askById = (value: string): AttentionAsk | undefined => ASKS.find((ask) => ask.id === value)
const verdictOf = (ask: string, patch: Loose) => run(patch).trace.verdicts[id(ask)]

const NEW_ASKS = [
    'virtual-account',
    'next-payment',
    'share-bank-details',
    'request-money',
    'send-money',
    'backup-passkey',
    'add-email',
    'rewards',
    'complete-profile',
]

const PUSH_UNANSWERED = { ready: true, unanswered: true, promptedThisSession: false, notEnabled: true }
const CARD_OFFER_OPEN = { loaded: true, geoProhibited: false, hasCardRelationship: false, promotionDisabled: false }
const QR_PAY_NOW = { canPayNow: true, hasMadeQrPayment: false, verifyOpensQr: false }
const QR_LOCKED = { canPayNow: false, hasMadeQrPayment: false, verifyOpensQr: true }
const DEPOSIT_CLAIMABLE = { enabled: true, loaded: true, claimable: 1, active: 0 }
const DEPOSIT_ACTIVE = { enabled: true, loaded: true, claimable: 0, active: 1 }
const NOT_ACTIVATED = { activated: false, onboarding: onboarding('first_payment') }
const HELD_FUNDS = { balance: { loaded: true, usd: 100 }, lastSpendAt: null }

describe('registry: the new asks follow the approved ranked list', () => {
    // spec "New asks" table: "Ask id | Tier · rank"; "all zone cards"
    test.each([
        ['virtual-account', 3, 1],
        ['next-payment', 3, 5],
        ['share-bank-details', 3, 6],
        ['request-money', 3, 7],
        ['send-money', 3, 8],
        ['backup-passkey', 4, 1],
        ['add-email', 4, 3],
        ['rewards', 5, 2],
        ['complete-profile', 5, 4],
    ])('%s is T%i · %i, zone only', (askId, tier, rank) => {
        const ask = askById(askId)
        expect(ask).toBeDefined()
        expect(ask?.tier).toBe(tier)
        expect(ask?.rank).toBe(rank)
        expect(ask?.surfaces).toEqual(['zone'])
    })

    test('not built: save-recipient and sync-contacts have no ask', () => {
        expect(askById('save-recipient')).toBeUndefined()
        expect(askById('sync-contacts')).toBeUndefined()
    })

    test('every new ask has its own analytics key', () => {
        // failure #10: "same attention_* events; analytics keys per ask"
        const keys = ASKS.map((ask) => ask.analyticsKey)
        for (const askId of NEW_ASKS) expect(askById(askId)?.analyticsKey).toBeTruthy()
        expect(new Set(keys).size).toBe(keys.length)
    })

    test('the base fixture has only the deadline candidate without a mounted slot', () => {
        expect(run().trace.candidates).toEqual(['verification-deadline'])
        expect(run().zone).toBeNull()
    })
})

/** `not-show`: done or ineligible; `not-yet`: anything but show (the spec does not say whether loading is unknown) */
type Expect = 'show' | 'not-show' | 'not-yet' | Verdict

describe('each new card’s eligibility rule', () => {
    test.each<[string, string, Loose, Expect]>([
        // virtual-account: "depositAccounts.enabled and claimable > 0 and active === 0; unknown while enabled and not loaded"
        ['virtual-account', 'enabled, claimable, none active', { depositAccounts: DEPOSIT_CLAIMABLE }, 'show'],
        [
            'virtual-account',
            'enabled, not loaded',
            { depositAccounts: { ...DEPOSIT_CLAIMABLE, loaded: false, claimable: 0 } },
            'unknown',
        ],
        ['virtual-account', 'feature off', { depositAccounts: { ...DEPOSIT_CLAIMABLE, enabled: false } }, 'not-show'],
        [
            'virtual-account',
            'feature off and not loaded is never unknown',
            { depositAccounts: { enabled: false, loaded: false, claimable: 0, active: 0 } },
            'not-show',
        ],
        // "no (verdict turns done once an account is active)"
        ['virtual-account', 'an account is active', { depositAccounts: { ...DEPOSIT_CLAIMABLE, active: 1 } }, 'done'],
        // failure #6: "deposit accounts query fails → loaded=true with 0/0 → ineligible"
        [
            'virtual-account',
            'query failed (loaded, 0/0)',
            { depositAccounts: { enabled: true, loaded: true, claimable: 0, active: 0 } },
            'ineligible',
        ],

        // next-payment: "activated, funds held, lastSpendAt older than 14 days (null = never spent counts as older),
        //  hasMadeQrPayment not undefined"
        ['next-payment', 'funds held, never spent', HELD_FUNDS, 'show'],
        ['next-payment', 'funds held, last spend 15 days ago', { ...HELD_FUNDS, lastSpendAt: daysAgo(15) }, 'show'],
        ['next-payment', 'spent 3 days ago', { ...HELD_FUNDS, lastSpendAt: daysAgo(3) }, 'not-show'],
        ['next-payment', 'no funds held', { ...HELD_FUNDS, balance: { loaded: true, usd: 0 } }, 'not-show'],
        // failure #3: "history loading flashes next-payment / request-money → unknown holds"
        [
            'next-payment',
            'history still loading',
            { ...HELD_FUNDS, qr: { canPayNow: false, hasMadeQrPayment: undefined, verifyOpensQr: false } },
            'unknown',
        ],
        ['next-payment', 'balance not loaded', { ...HELD_FUNDS, balance: { loaded: false, usd: 100 } }, 'not-yet'],
        ['next-payment', 'not activated', { ...HELD_FUNDS, ...NOT_ACTIVATED }, 'not-show'],

        // share-bank-details: "depositAccounts.active > 0"
        ['share-bank-details', 'an account is active', { depositAccounts: DEPOSIT_ACTIVE }, 'show'],
        ['share-bank-details', 'no active account', { depositAccounts: DEPOSIT_CLAIMABLE }, 'not-show'],

        // request-money: "activated and hasReceivedRequestPayment === false (undefined = unknown)"
        ['request-money', 'never received a request payment', { hasReceivedRequestPayment: false }, 'show'],
        ['request-money', 'already received one', { hasReceivedRequestPayment: true }, 'not-show'],
        ['request-money', 'history still loading', { hasReceivedRequestPayment: undefined }, 'unknown'],
        ['request-money', 'not activated', { hasReceivedRequestPayment: false, ...NOT_ACTIVATED }, 'not-show'],

        // send-money: "activated and firstPeerPaymentAt === null"
        ['send-money', 'never paid a peer', { firstPeerPaymentAt: null }, 'show'],
        ['send-money', 'already paid a peer', { firstPeerPaymentAt: daysAgo(5) }, 'not-show'],
        ['send-money', 'not activated', { firstPeerPaymentAt: null, ...NOT_ACTIVATED }, 'not-show'],

        // backup-passkey: "passkeyCount === 1 (null = API too old → ineligible, never unknown)"
        ['backup-passkey', 'one passkey', { passkeyCount: 1 }, 'show'],
        // "no (verdict turns done at 2 credentials)"
        ['backup-passkey', 'two passkeys', { passkeyCount: 2 }, 'done'],
        ['backup-passkey', 'three passkeys', { passkeyCount: 3 }, 'done'],
        // failure #1: "API without passkeyCount → null → backup ask ineligible"
        ['backup-passkey', 'API too old (null)', { passkeyCount: null }, 'ineligible'],
        // failure #2: "passkeyCount 0 → ineligible"
        ['backup-passkey', 'zero passkeys (bad row)', { passkeyCount: 0 }, 'ineligible'],

        // add-email: "hasEmail === false"
        ['add-email', 'no email', { hasEmail: false }, 'show'],
        ['add-email', 'has email', { hasEmail: true }, 'not-show'],

        // rewards: "activated and rewardsPendingUsd > 0 (undefined = unknown)"
        ['rewards', 'pending rewards', { rewardsPendingUsd: 5 }, 'show'],
        ['rewards', 'nothing pending', { rewardsPendingUsd: 0 }, 'not-show'],
        ['rewards', 'rewards still loading', { rewardsPendingUsd: undefined }, 'unknown'],
        ['rewards', 'not activated', { rewardsPendingUsd: 5, ...NOT_ACTIVATED }, 'not-show'],

        // complete-profile: "activated and hasFullName === false"
        ['complete-profile', 'no full name', { hasFullName: false }, 'show'],
        ['complete-profile', 'has full name', { hasFullName: true }, 'not-show'],
        ['complete-profile', 'not activated', { hasFullName: false, ...NOT_ACTIVATED }, 'not-show'],
    ])('%s — %s', (ask, _label, patch, expected) => {
        const verdict = verdictOf(ask, patch)
        expect(verdict).toBeDefined()
        if (expected === 'not-show') expect(['done', 'ineligible']).toContain(verdict)
        else if (expected === 'not-yet') expect(verdict).not.toBe('show')
        else expect(verdict).toBe(expected)
    })
})

describe('the ranked order with every card eligible', () => {
    // spec tester brief: "expected order by tier then rank, with the phase-3 cards interleaved"
    const FULL_ORDER = [
        'verification-advisory',
        'verification-deadline',
        'virtual-account',
        'qr-payment',
        'verify-for-qr',
        'card-offer',
        'next-payment',
        'share-bank-details',
        'request-money',
        'send-money',
        'backup-passkey',
        'push-home-fallback',
        'add-email',
        'user-interview',
        'invite',
        'rewards',
        'complete-profile',
        'bug-bounty',
    ]

    const everyCard = {
        documentSlideKey: 'doc-request:proof-of-address',
        cardOffer: CARD_OFFER_OPEN,
        push: PUSH_UNANSWERED,
        invitesSent: 0,
        hasSupportSurvivorBadge: false,
        flags: { userInterview: true },
        balance: { loaded: true, usd: 100 },
        lastSpendAt: null,
        hasReceivedRequestPayment: false,
        firstPeerPaymentAt: null,
        passkeyCount: 1,
        hasEmail: false,
        rewardsPendingUsd: 5,
        hasFullName: false,
    }

    // qr-payment / verify-for-qr exclude each other on qr.canPayNow, and virtual-account / share-bank-details
    // on depositAccounts.active, so the full order is checked across two states
    test.each<[string, Loose, string[]]>([
        [
            'QR open, an account to claim',
            { qr: QR_PAY_NOW, depositAccounts: DEPOSIT_CLAIMABLE },
            ['verify-for-qr', 'share-bank-details'],
        ],
        [
            'QR locked, an account active',
            { qr: QR_LOCKED, depositAccounts: DEPOSIT_ACTIVE },
            ['qr-payment', 'virtual-account'],
        ],
    ])('%s: candidates in tier-then-rank order', (_label, patch, excluded) => {
        const d = run({ ...everyCard, ...patch })
        expect(d.trace.candidates).toEqual(FULL_ORDER.filter((askId) => !excluded.includes(askId)))
        expect(d.zone).toEqual({ id: 'verification-advisory', mode: 'ask' })
    })

    test('without the advisory, the virtual account leads the zone', () => {
        const d = run({ ...everyCard, documentSlideKey: null, qr: QR_PAY_NOW, depositAccounts: DEPOSIT_CLAIMABLE })
        expect(d.zone).toEqual({ id: 'virtual-account', mode: 'ask' })
    })
})

describe('no flash while history loads', () => {
    // failure #3: "history loading flashes next-payment / request-money → unknown holds"
    const inviteOnly = { invitesSent: 0 }

    test.each<[string, Loose]>([
        [
            'next-payment',
            { ...HELD_FUNDS, qr: { canPayNow: false, hasMadeQrPayment: undefined, verifyOpensQr: false } },
        ],
        ['request-money', { hasReceivedRequestPayment: undefined }],
    ])('%s unknown holds the invite card until the deadline', (ask, loading) => {
        const patch = { ...inviteOnly, ...loading }
        expect(verdictOf(ask, patch)).toBe('unknown')
        expect(run(patch).zone).toBeNull()
        expect(run(patch, { settleDeadlinePassed: true }).zone).toEqual({ id: 'invite', mode: 'ask' })
    })
})

describe('rewards re-arms only on a new pending balance', () => {
    // "Version: String(rewardsPendingUsd) so a new balance re-arms"; failure #4
    const dismissedAt5 = { rewards: { dismissedAt: daysAgo(1), version: '5' } }

    test('the version is the pending amount', () => {
        expect(askById('rewards')?.version?.(stateOf({ rewardsPendingUsd: 5 }))).toBe('5')
    })

    test('a dismissal holds for the same balance', () => {
        expect(run({ rewardsPendingUsd: 5 }, {}, dismissedAt5).trace.candidates).not.toContain('rewards')
    })

    test('a new balance brings the card back', () => {
        expect(run({ rewardsPendingUsd: 7 }, {}, dismissedAt5).trace.candidates).toContain('rewards')
    })
})

describe('balance-backup follows the passkey count', () => {
    // "when passkeyCount >= 2 the ask is done; null keeps today's behaviour"
    const highBalance = { balance: { loaded: true, usd: 1000 } }

    test.each<[number | null, Verdict]>([
        [1, 'show'],
        [null, 'show'],
        [2, 'done'],
        [3, 'done'],
    ])('passkeyCount %p with a high balance → %s', (passkeyCount, expected) => {
        expect(verdictOf('balance-backup', { ...highBalance, passkeyCount })).toBe(expected)
    })
})

describe('parity over the real modules', () => {
    test('every new ask has a ZONE_SURFACES entry', () => {
        const { ZONE_SURFACES } = jest.requireActual('../zoneSurfaces') as {
            ZONE_SURFACES: Partial<Record<string, unknown>>
        }
        expect(NEW_ASKS.filter((askId) => !ZONE_SURFACES[askId])).toEqual([])
    })
})
