/**
 * Card setup follows the server's funding decision (`setupPath`):
 * `finish-card-setup` is the prompt for the existing card permission only,
 * and an unread decision holds it as `unknown`.
 */
import { decide } from '../decide'
import { ASKS, finishCardSetup } from '../registry'
import type { JourneyState, Ledger, Session } from '../types'

const NOW = Date.parse('2026-11-02T12:00:00Z')

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
    card: { loaded: true, needsSetup: false, activeCardId: null, setupPath: 'none' },
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
