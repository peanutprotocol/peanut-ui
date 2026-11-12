/**
 * Card setup has two prompts, picked by the server's funding decision
 * (`setupPath`): `finish-card-setup` (the existing card permission) and
 * `finish-card-funding` (managed funding, dev's FundingSetupPrompt). At most
 * one is live for a card, and an unread decision holds both as `unknown`.
 */
import { decide } from '../decide'
import { ASKS, finishCardFunding, finishCardSetup } from '../registry'
import type { JourneyState, Ledger, Session } from '../types'

const NOW = Date.parse('2026-11-02T12:00:00Z')
const DAY_MS = 24 * 60 * 60 * 1000

type Card = JourneyState['card']

const baseState = {
    capNudge: null,
    maintenance: 'none',
    now: NOW,
    userId: 'user-a',
    userLoaded: true,
    isNative: true,
    route: 'home',
    consent: { status: 'clear', versions: [], documents: [] },
    identity: {
        status: 'approved',
        isVerified: true,
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
    card: { loaded: true, needsSetup: false, activeCardId: null, setupPath: 'none', needsFunding: false },
    postAuthRedirect: false,
    postAuthRedirectDestination: null,
    balance: { loaded: true, usd: 0 },
    migration: { on: false },
    push: { ready: true, unanswered: false, promptedThisSession: false, notEnabled: false },
    showEarlyUserModal: false,
    activated: true,
    geoCountry: null,
    invitesSent: 3,
    hasSupportSurvivorBadge: true,
    cardOffer: { loaded: true, geoProhibited: false, hasCardRelationship: true, promotionDisabled: false },
    qr: { canPayNow: false, hasMadeQrPayment: true, verifyOpensQr: false },
    documentSlideKey: null,
    flags: { userInterview: false },
    depositAccounts: { enabled: false, loaded: true, claimable: 0, active: 0 },
    lastSpendAt: new Date(NOW).toISOString(),
    hasReceivedRequestPayment: true,
    firstPeerPaymentAt: '2026-09-01T00:00:00.000Z',
    passkeyCount: 2,
    hasEmail: true,
    hasFullName: true,
    rewardsPendingUsd: 0,
    serverLedger: undefined,
    arrival: 'none',
} as unknown as JourneyState

const session: Session = {
    count: 5,
    route: 'home',
    interruptsThisSession: [],
    openInterrupt: null,
    busy: false,
    gateUp: false,
    settleDeadlinePassed: false,
    slots: [],
}

const stateWith = (card: Partial<Card>): JourneyState => ({
    ...baseState,
    card: { ...baseState.card, activeCardId: 'card-a', ...card },
})

const run = (card: Partial<Card>, ledger: Ledger = {}, patch: Partial<Session> = {}) =>
    decide(stateWith(card), ASKS, ledger, { ...session, ...patch })

describe('finish-card-setup follows the funding decision', () => {
    test('shows only for an account on the existing card permission', () => {
        expect(finishCardSetup.eligible(stateWith({ needsSetup: true, setupPath: 'legacy' }))).toBe('show')
        expect(run({ needsSetup: true, setupPath: 'legacy' }).interrupt).toBe('finish-card-setup')
    })

    test('is unknown while the decision loads, so it never opens invisible', () => {
        expect(finishCardSetup.eligible(stateWith({ needsSetup: true, setupPath: 'unknown' }))).toBe('unknown')
        expect(run({ needsSetup: true, setupPath: 'unknown' }).interrupt).toBeNull()
    })

    test.each(['managed', 'none'] as const)('is ineligible on the %s path', (setupPath) => {
        expect(finishCardSetup.eligible(stateWith({ needsSetup: true, setupPath }))).toBe('ineligible')
        expect(run({ needsSetup: true, setupPath }).interrupt).toBeNull()
    })

    test('a card that needs no setup is ineligible whatever the decision', () => {
        expect(finishCardSetup.eligible(stateWith({ needsSetup: false, setupPath: 'unknown' }))).toBe('ineligible')
    })
})

describe('finish-card-funding (dev FundingSetupPrompt)', () => {
    test('a T1 interrupt ranked right after finish-card-setup', () => {
        expect(finishCardFunding).toMatchObject({ tier: 1, rank: 7, surfaces: ['interrupt'], presentation: 'modal' })
        const tierOne = ASKS.filter((ask) => ask.tier === 1 && ask.surfaces.includes('interrupt'))
        expect(finishCardFunding.rank).toBe(finishCardSetup.rank + 1)
        expect(tierOne.filter((ask) => ask.rank > finishCardFunding.rank).map((ask) => ask.id)).toEqual([
            'app-update-important',
        ])
        expect(tierOne.filter((ask) => ask.rank === finishCardFunding.rank)).toHaveLength(1)
    })

    test('shows exactly when the prompt would: managed path and something to set up', () => {
        expect(finishCardFunding.eligible(stateWith({ setupPath: 'managed', needsFunding: true }))).toBe('show')
        expect(run({ setupPath: 'managed', needsFunding: true }).interrupt).toBe('finish-card-funding')
        expect(finishCardFunding.eligible(stateWith({ setupPath: 'managed', needsFunding: false }))).toBe('ineligible')
    })

    test('is unknown while the decision or the funding state loads', () => {
        expect(finishCardFunding.eligible(stateWith({ setupPath: 'unknown' }))).toBe('unknown')
        expect(finishCardFunding.eligible(stateWith({ setupPath: 'managed', needsFunding: undefined }))).toBe('unknown')
        expect(finishCardFunding.eligible(stateWith({ loaded: false }))).toBe('unknown')
    })

    test.each(['legacy', 'none'] as const)('is ineligible on the %s path', (setupPath) => {
        expect(finishCardFunding.eligible(stateWith({ setupPath, needsFunding: true, needsSetup: true }))).toBe(
            'ineligible'
        )
    })

    test('the two card prompts are never live for one card at once', () => {
        for (const setupPath of ['unknown', 'managed', 'legacy', 'none'] as const) {
            for (const needsSetup of [true, false]) {
                for (const needsFunding of [true, false, undefined]) {
                    const state = stateWith({ setupPath, needsSetup, needsFunding })
                    const live = [finishCardSetup, finishCardFunding].filter((ask) => ask.eligible(state) === 'show')
                    expect(live.length).toBeLessThanOrEqual(1)
                }
            }
        }
    })

    test('opens on Home only, after the terms, and holds while a higher T1 is open', () => {
        expect(run({ setupPath: 'managed', needsFunding: true }, {}, { route: 'other' }).interrupt).toBeNull()
        const terms = {
            ...stateWith({ setupPath: 'managed', needsFunding: true }),
            consent: {
                status: 'needed' as const,
                versions: ['2026-11-01'],
                documents: [{ slug: 'terms', currentVersion: '2026-11-01' }],
            },
        }
        expect(decide(terms, ASKS, {}, session).interrupt).toBe('legal-reconsent')
        expect(decide(terms, ASKS, {}, { ...session, openInterrupt: 'legal-reconsent' }).interrupt).toBe(
            'legal-reconsent'
        )
    })

    test('"Skip for now" holds it until the snooze ends; a re-issued card asks again', () => {
        const until = new Date(NOW + 60 * 60 * 1000).toISOString()
        const ledger: Ledger = { 'finish-card-funding': { snoozedUntil: until, version: 'card-a' } }
        expect(run({ setupPath: 'managed', needsFunding: true }, ledger).interrupt).toBeNull()
        expect(run({ setupPath: 'managed', needsFunding: true, activeCardId: 'card-b' }, ledger).interrupt).toBe(
            'finish-card-funding'
        )
    })

    test('a finished setup never silences the prompt if the same card needs funding again', () => {
        const ledger: Ledger = {
            'finish-card-funding': { dismissedAt: new Date(NOW - DAY_MS).toISOString(), version: 'card-a' },
        }
        expect(run({ setupPath: 'managed', needsFunding: true }, ledger).interrupt).toBe('finish-card-funding')
    })
})
