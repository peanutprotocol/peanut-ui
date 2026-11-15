import { decide } from '../decide'
import { ASKS } from '../registry'
import type { JourneyState, Ledger, Session } from '../types'

const NOW = Date.parse('2026-10-12T12:00:00Z')
const onboarding = (completed = false) => ({
    verify: completed ? ('done' as const) : ('todo' as const),
    addMoneyDone: completed,
    firstPaymentDone: completed,
    firstPaymentRoute: 'card_qr' as const,
    step: completed ? ('completed' as const) : ('verify' as const),
})

export const state = (patch: Partial<JourneyState> = {}): JourneyState => ({
    capNudge: null,
    maintenance: 'none',
    now: NOW,
    userId: 'user-a',
    userLoaded: true,
    isNative: true,
    deviceType: 'ios',
    route: 'home',
    consent: { status: 'clear', versions: [], documents: [] },
    identity: {
        status: 'not_started',
        isVerified: false,
        needsAction: false,
        isTerminalFailure: false,
        isRegionRestricted: false,
    },
    onboarding: onboarding(),
    blockedCardId: null,
    dueTasks: 0,
    card: { loaded: true, needsSetup: false, activeCardId: null, setupPath: 'none', needsFunding: false },
    postAuthRedirect: false,
    postAuthRedirectDestination: null,
    balance: { loaded: true, usd: 0 },
    migration: { on: false },
    push: { ready: true, unanswered: false, promptedThisSession: false, notEnabled: false },
    showEarlyUserModal: false,
    activated: false,
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
    serverLedger: undefined,
    arrival: 'none',
    ...patch,
})

export const baseSession: Session = {
    count: 3,
    route: 'home',
    interruptsThisSession: [],
    openInterrupt: null,
    busy: false,
    gateUp: false,
    settleDeadlinePassed: false,
    slots: [],
}

export const run = (patch: Partial<JourneyState> = {}, session: Partial<Session> = {}, ledger: Ledger = {}) =>
    decide(state(patch), ASKS, ledger, { ...baseSession, ...session })
