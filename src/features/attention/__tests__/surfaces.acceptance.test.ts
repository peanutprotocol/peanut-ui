import { checklist, nextPayment, postVerificationAction } from '../registry'
import type { JourneyState } from '../types'

/** Spec-derived fixtures: capability absence is deliberately distinct from proven access. */
function journey(): JourneyState {
    return {
        now: Date.parse('2026-11-02T12:00:00.000Z'),
        userId: 'acceptance-user',
        userLoaded: true,
        capNudge: null,
        maintenance: 'none',
        isNative: false,
        route: 'home',
        consent: { status: 'clear', versions: [], documents: [] },
        identity: {
            status: undefined,
            isVerified: true,
            needsAction: false,
            isTerminalFailure: false,
            isRegionRestricted: false,
        },
        onboarding: {
            verify: 'done',
            addMoneyDone: true,
            firstPaymentDone: false,
            firstPaymentRoute: 'qr',
            step: 'first_payment',
        },
        blockedCardId: null,
        dueTasks: 0,
        card: {
            loaded: true,
            needsSetup: false,
            activeCardId: null,
            setupPath: 'none',
            needsFunding: false,
        },
        postAuthRedirect: false,
        postAuthRedirectDestination: null,
        balance: { loaded: true, usd: 100 },
        migration: { on: false },
        push: { ready: true, unanswered: false, promptedThisSession: false, notEnabled: false },
        showEarlyUserModal: false,
        activated: true,
        geoCountry: null,
        invitesSent: 0,
        hasSupportSurvivorBadge: false,
        cardOffer: { loaded: true, geoProhibited: false, hasCardRelationship: false, promotionDisabled: false },
        qr: { canPayNow: false, hasMadeQrPayment: true, verifyOpensQr: false },
        documentSlideKey: null,
        flags: { userInterview: false },
        depositAccounts: { enabled: false, loaded: true, claimable: 0, active: 0 },
        lastSpendAt: '2025-11-02T12:00:00.000Z',
        hasReceivedRequestPayment: false,
        firstPeerPaymentAt: null,
        passkeyCount: 1,
        hasEmail: true,
        hasFullName: true,
        rewardsPendingUsd: 0,
        serverLedger: {},
        arrival: 'none',
    }
}

describe('attention surfaces: accepted behavior', () => {
    describe('blocked checklist', () => {
        it.each(['verify', 'add_money', 'first_payment'] as const)(
            'suppresses an incomplete %s checklist until the blocker is removed',
            (step) => {
                const state = journey()
                state.activated = false
                state.onboarding = {
                    verify: step === 'verify' ? 'todo' : 'done',
                    addMoneyDone: step === 'first_payment',
                    firstPaymentDone: false,
                    firstPaymentRoute: 'qr',
                    step,
                }
                state.blockedCardId = 'blocked-card-for-acceptance'
                expect(checklist.eligible(state)).toBe('ineligible')

                state.blockedCardId = null
                expect(checklist.eligible(state)).toBe('show')
            }
        )
    })

    describe('post-verification ledger version privacy', () => {
        it.each([
            ['/claim', '/claim'],
            ['/pay-request', '/pay-request'],
            ['/claim?token=query-secret', '/claim'],
            ['/pay-request?request=request-secret', '/pay-request'],
            ['/claim#bearer=fragment-secret', '/claim'],
            ['/pay-request#bearer=fragment-secret', '/pay-request'],
            ['/claim?token=query-secret#bearer=fragment-secret', '/claim'],
            ['/pay-request#bearer=fragment-secret?token=fragment-query-secret', '/pay-request'],
        ])('uses only the path of %s', (destination, expectedPath) => {
            const state = journey()
            state.postAuthRedirect = true
            state.postAuthRedirectDestination = destination
            expect(postVerificationAction.version).toBeDefined()
            expect(postVerificationAction.version!(state)).toBe(expectedPath)
        })

        it('has no destination version when no destination exists', () => {
            const state = journey()
            state.postAuthRedirectDestination = null
            expect(postVerificationAction.version).toBeDefined()
            expect(postVerificationAction.version!(state)).toBeUndefined()
        })
    })

    describe('next-payment capability gating', () => {
        it.each([undefined, false])('requires a usable rail when card capability is %s', (canSpendViaCard) => {
            const state = journey()
            if (canSpendViaCard !== undefined) {
                state.cardOffer = { ...state.cardOffer, canSpendViaCard } as JourneyState['cardOffer']
            }
            expect(nextPayment.eligible(state)).toBe('ineligible')
        })

        it('allows a previous QR payer to pay again when QR is usable', () => {
            const state = journey()
            state.qr.canPayNow = true
            expect(nextPayment.eligible(state)).toBe('show')
        })

        it('allows a previous QR payer to pay again using a usable card', () => {
            const state = journey()
            state.card.activeCardId = 'active-card'
            state.cardOffer = {
                ...state.cardOffer,
                hasCardRelationship: true,
                canSpendViaCard: true,
            } as JourneyState['cardOffer']
            expect(nextPayment.eligible(state)).toBe('show')
        })
    })
})
