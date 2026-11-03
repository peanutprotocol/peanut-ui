/** UI Jest environment. Synthetic public asks test arbitration, not registry eligibility. */
import { describe, expect, it } from '@jest/globals'
import { decide } from '@/features/attention/decide'
import { applyServerRanking } from '@/features/attention/serverAttention'
import type { AttentionAsk, JourneyState, Session } from '@/features/attention/types'

const state: JourneyState = {
    capNudge: null,
    maintenance: 'none',
    now: Date.parse('2026-11-03T12:00:00.000Z'),
    userId: 'engine-user',
    userLoaded: true,
    isNative: true,
    deviceType: 'ios',
    route: 'home',
    consent: { status: 'clear', versions: [], documents: [] },
    identity: {
        status: undefined,
        isVerified: true,
        needsAction: false,
        isTerminalFailure: false,
        isRegionRestricted: false,
    },
    onboarding: null,
    blockedCardId: null,
    dueTasks: 0,
    card: { loaded: true, needsSetup: false, activeCardId: 'test-card', setupPath: 'none', needsFunding: false },
    postAuthRedirect: false,
    postAuthRedirectDestination: null,
    balance: { loaded: true, usd: 10 },
    migration: { on: false },
    push: { ready: true, unanswered: false, promptedThisSession: false, notEnabled: false },
    showEarlyUserModal: false,
    activated: true,
    geoCountry: 'GB',
    invitesSent: 0,
    hasSupportSurvivorBadge: false,
    cardOffer: {
        loaded: true,
        geoProhibited: false,
        hasCardRelationship: true,
        promotionDisabled: false,
        canSpendViaCard: true,
    },
    qr: { canPayNow: true, hasMadeQrPayment: true, verifyOpensQr: false },
    documentSlideKey: 'advisory-v1',
    flags: { userInterview: false },
    depositAccounts: { enabled: false, loaded: true, claimable: 0, active: 0 },
    lastSpendAt: null,
    hasReceivedRequestPayment: false,
    firstPeerPaymentAt: null,
    passkeyCount: 1,
    hasEmail: true,
    hasFullName: true,
    rewardsPendingUsd: 0,
    serverLedger: {},
    arrival: 'none',
}
const session: Session = {
    slots: [],
    count: 3,
    route: 'home',
    interruptsThisSession: [],
    openInterrupt: null,
    busy: false,
    gateUp: false,
    settleDeadlinePassed: true,
}
const due: AttentionAsk = {
    id: 'verification-deadline',
    tier: 1,
    rank: 0,
    surfaces: ['interrupt', 'zone'],
    eligible: () => 'show',
    policy: { interrupt: 'always' },
    analyticsKey: 'acceptance-due',
}
const advisory: AttentionAsk = {
    id: 'verification-advisory',
    tier: 3,
    rank: 0,
    surfaces: ['interrupt', 'zone'],
    eligible: () => 'show',
    policy: { interrupt: 'session' },
    analyticsKey: 'acceptance-advisory',
}

describe('Direct unchanged engine protections', () => {
    it('ENGINE.1 T1 priority wins independently of input order', () => {
        for (const asks of [
            [advisory, due],
            [due, advisory],
        ]) {
            const result = decide(state, asks, {}, session)
            expect(result.interrupt).toBe(due.id)
        }
    })
    it('ENGINE.2 a server show verdict cannot bypass a local device exclusion', () => {
        const asks = applyServerRanking([{ ...due, deviceGate: () => 'ineligible' }, advisory], {
            version: 1,
            ranking: [{ id: due.id, tier: 1, rank: 0 }],
            verdicts: { [due.id]: 'show' },
            nextAsk: due.id,
        })
        const result = decide(state, asks, {}, session)
        expect(result.interrupt).not.toBe(due.id)
        expect(result.zone?.id).not.toBe(due.id)
        expect(result.interrupt).toBe(advisory.id)
    })
})
