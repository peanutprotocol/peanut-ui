/**
 * Phase 9, U2: the server's ranking and verdicts applied over the local registry.
 *
 * Every expectation cites phase9-spec.md. Written from the spec, before the code.
 */
import { decide } from '../decide'
import { ASKS } from '../registry'
import { applyServerRanking, asServerAttention } from '../serverAttention'
import type { AttentionAsk, JourneyState, Ledger, Session } from '../types'

type Server = NonNullable<Parameters<typeof applyServerRanking>[1]>
type Loose = Record<string, unknown>

const NOW = Date.parse('2026-10-12T12:00:00Z')

/** An activated user with nothing to show (zone.decide.test.ts's base): each row turns one card on. */
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
    onboarding: {
        verify: 'done',
        addMoneyDone: true,
        firstPaymentDone: true,
        firstPaymentRoute: 'card_qr',
        step: 'completed',
    },
    blockedCardId: null,
    dueTasks: 0,
    card: { loaded: true, needsSetup: false, activeCardId: null },
    postAuthRedirect: false,
    postAuthRedirectDestination: null,
    balance: { loaded: true, usd: 0 },
    migration: { on: false },
    push: { ready: true, unanswered: false, promptedThisSession: false, notEnabled: false },
    showEarlyUserModal: false,
    activated: true,
    geoCountry: 'US',
    invitesSent: 1,
    hasSupportSurvivorBadge: true,
    cardOffer: { loaded: true, geoProhibited: false, hasCardRelationship: true, promotionDisabled: false },
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
    slots: [],
}

const stateOf = (patch: Loose = {}) => ({ ...baseState, ...patch }) as unknown as JourneyState

const localRanking = () => ASKS.map(({ id, tier, rank }) => ({ id, tier, rank }))

/** the endpoint's body: `{ version: 1, ranking: ASK_RANKING, verdicts, nextAsk }` */
const serverOf = (patch: Loose = {}) =>
    ({ version: 1, ranking: localRanking(), verdicts: {}, nextAsk: null, ...patch }) as unknown as Server

const byId = (asks: readonly AttentionAsk[], id: string) => asks.find((ask) => ask.id === id)

// invite (T5·1) and bug-bounty (T5·5) both want the zone; locally the invite wins
const TWO_CARDS = { invitesSent: 0, hasSupportSurvivorBadge: false }

describe('applyServerRanking', () => {
    // "With server undefined it returns asks unchanged"
    test('without a server answer the asks come back unchanged', () => {
        expect(applyServerRanking(ASKS, undefined)).toBe(ASKS)
    })

    // "tier/rank come from server.ranking when the id is present (otherwise local values)"
    test('the server ranking overrides tier and rank by id; asks it does not name keep theirs', () => {
        const ranking = [
            { id: 'invite', tier: 2, rank: 9 },
            { id: 'bug-bounty', tier: 3, rank: 0 },
        ]
        const out = applyServerRanking(ASKS, serverOf({ ranking }))

        expect(byId(out, 'invite')).toMatchObject({ tier: 2, rank: 9 })
        expect(byId(out, 'bug-bounty')).toMatchObject({ tier: 3, rank: 0 })
        const local = byId(ASKS, 'checklist')
        expect(byId(out, 'checklist')).toMatchObject({ tier: local?.tier, rank: local?.rank })
        expect(out.map((ask) => ask.id)).toEqual(ASKS.map((ask) => ask.id))
    })

    // "eligible returns server.verdicts[id] when present"
    test('a server verdict wins over the local eligible', () => {
        const state = stateOf(TWO_CARDS)
        expect(byId(ASKS, 'invite')?.eligible(state)).toBe('show')

        const out = applyServerRanking(ASKS, serverOf({ verdicts: { invite: 'done' } }))
        expect(byId(out, 'invite')?.eligible(state)).toBe('done')
    })

    test('a server show wins over a local ineligible', () => {
        const state = stateOf({ invitesSent: 3 })
        expect(byId(ASKS, 'invite')?.eligible(state)).toBe('ineligible')

        const out = applyServerRanking(ASKS, serverOf({ verdicts: { invite: 'show' } }))
        expect(byId(out, 'invite')?.eligible(state)).toBe('show')
    })

    // "otherwise the local eligible(state)"; failure #5 "local verdict used when the server has none"
    test('without a server verdict the local eligible decides', () => {
        const out = applyServerRanking(ASKS, serverOf({ verdicts: { checklist: 'done' } }))
        for (const patch of [TWO_CARDS, { invitesSent: 3 }, { activated: false }]) {
            const state = stateOf(patch)
            expect(byId(out, 'invite')?.eligible(state)).toBe(byId(ASKS, 'invite')?.eligible(state))
            expect(byId(out, 'bug-bounty')?.eligible(state)).toBe(byId(ASKS, 'bug-bounty')?.eligible(state))
        }
    })

    // "when the id is present"; an id the client does not know adds nothing
    test('server ids the client does not know are ignored', () => {
        const server = serverOf({
            ranking: [...localRanking(), { id: 'future-ask', tier: 1, rank: 0 }],
            verdicts: { 'future-ask': 'show' },
        })
        const out = applyServerRanking(ASKS, server)

        expect(out.map((ask) => ask.id)).toEqual(ASKS.map((ask) => ask.id))
        expect(byId(out, 'future-ask')).toBeUndefined()
    })
})

describe('decide() over the server ranking', () => {
    const run = (asks: readonly AttentionAsk[], patch: Loose = {}) =>
        decide(stateOf(patch), asks, {} as Ledger, baseSession)

    // "The provider calls decide(state, applyServerRanking(ASKS, server), ledger, session)"
    test('the local ranking puts the invite in the zone', () => {
        expect(run(ASKS, TWO_CARDS).zone).toEqual({ id: 'invite', mode: 'ask' })
        expect(run(applyServerRanking(ASKS, undefined), TWO_CARDS).zone).toEqual({ id: 'invite', mode: 'ask' })
    })

    // failure #8 "the server ranking is authoritative; the UI uses it whenever present"
    test('a server ranking that puts bug-bounty above the invite flips the zone pick', () => {
        const ranking = localRanking().map((entry) =>
            entry.id === 'bug-bounty' ? { ...entry, tier: 5, rank: 0 } : entry
        )
        const d = run(applyServerRanking(ASKS, serverOf({ ranking })), TWO_CARDS)

        expect(d.zone).toEqual({ id: 'bug-bounty', mode: 'ask' })
        expect(d.trace.candidates.indexOf('bug-bounty')).toBeLessThan(d.trace.candidates.indexOf('invite'))
    })

    test('a server verdict that the invite is done hands the zone to the next card', () => {
        const d = run(applyServerRanking(ASKS, serverOf({ verdicts: { invite: 'done' } })), TWO_CARDS)
        expect(d.zone).toEqual({ id: 'bug-bounty', mode: 'ask' })
    })

    test('a server verdict can put a card in the zone the local data would not', () => {
        const d = run(applyServerRanking(ASKS, serverOf({ verdicts: { invite: 'show' } })), { invitesSent: 3 })
        expect(d.zone).toEqual({ id: 'invite', mode: 'ask' })
    })
})

describe('asServerAttention', () => {
    test.each([{}, [], null, 'ok', { version: 2, ranking: [], verdicts: {} }, { version: 1, verdicts: {} }])(
        'a body that is not a version-1 answer reads as no answer: %j',
        (body) => {
            expect(asServerAttention(body)).toBeUndefined()
        }
    )

    test('a version-1 answer passes through', () => {
        const body = { version: 1, ranking: [], verdicts: {}, nextAsk: null }
        expect(asServerAttention(body)).toBe(body)
    })
})
