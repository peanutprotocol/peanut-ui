import {
    buildJourneyState,
    summarizeHistory,
    cardNeedsSetup,
    hasPostSignupRedirect,
    outdatedConsentVersions,
    type JourneyInputs,
} from '../journeyState'
import type { RainCardOverview } from '@/services/rain'

const base: JourneyInputs = {
    now: 0,
    userId: 'user-a',
    userLoaded: true,
    isNative: true,
    pathname: '/home/',
    consentDocuments: [],
    consentFailed: false,
    identity: {
        status: 'verified',
        isVerified: true,
        needsAction: false,
        isTerminalFailure: false,
        isRegionRestricted: false,
    },
    onboarding: null,
    blockedCardId: null,
    dueTasks: 0,
    cardLoaded: true,
    cardNeedsSetup: false,
    activeCardId: null,
    redirectDestination: undefined,
    balanceUnits: undefined,
    migrationOn: false,
    pushReady: false,
    pushUnanswered: false,
    pushPromptedThisSession: false,
    pushNotEnabled: false,
    activated: false,
    geoCountry: null,
    invitesSent: 0,
    hasSupportSurvivorBadge: false,
    cardOffer: { loaded: true, geoProhibited: false, hasCardRelationship: false, promotionDisabled: false },
    qr: { canPayNow: false, hasMadeQrPayment: false, verifyOpensQr: false },
    documentSlideKey: null,
    userInterviewFlag: false,
    depositAccounts: { enabled: false, loaded: true, claimable: 0, active: 0 },
    history: undefined,
    firstPeerPaymentAt: null,
    passkeyCount: null,
    hasEmail: true,
    hasFullName: true,
    rewardsPendingUsd: 0,
    serverLedger: undefined,
    showEarlyUserModal: undefined,
}

describe('buildJourneyState', () => {
    test('native trailing-slash Home is Home', () => {
        expect(buildJourneyState(base).route).toBe('home')
        expect(buildJourneyState({ ...base, pathname: '/profile' }).route).toBe('other')
    })

    test('consent: loading is unknown, a failed check fails open, documents mean needed', () => {
        expect(buildJourneyState({ ...base, consentDocuments: undefined }).consent.status).toBe('unknown')
        expect(buildJourneyState({ ...base, consentDocuments: undefined, consentFailed: true }).consent.status).toBe(
            'clear'
        )
        expect(
            buildJourneyState({ ...base, consentDocuments: [{ slug: 'terms', currentVersion: '2026-10-01' }] }).consent
        ).toEqual({
            status: 'needed',
            versions: ['2026-10-01'],
            documents: [{ slug: 'terms', currentVersion: '2026-10-01' }],
        })
    })

    test('balance in USD from USDC base units; unloaded while undefined', () => {
        expect(buildJourneyState(base).balance).toEqual({ loaded: false, usd: 0 })
        expect(buildJourneyState({ ...base, balanceUnits: 512_250_000n }).balance).toEqual({
            loaded: true,
            usd: 512.25,
        })
    })
})

describe('outdatedConsentVersions', () => {
    const doc = (slug: string, needsAcceptance = true) => ({
        slug,
        currentVersion: '2026-10-01',
        acceptedVersion: null,
        acceptedAt: null,
        needsAcceptance,
    })
    test('only documents this client can display count', () => {
        expect(outdatedConsentVersions(undefined)).toBeUndefined()
        expect(outdatedConsentVersions({ needsReConsent: false, documents: [doc('terms')] })).toEqual([])
        expect(
            outdatedConsentVersions({
                needsReConsent: true,
                documents: [doc('terms'), doc('privacy', false), doc('unknown-doc')],
            })
        ).toEqual(['2026-10-01'])
    })
})

describe('cardNeedsSetup', () => {
    const overview = (
        card: Partial<RainCardOverview['cards'][number]>,
        status: Partial<RainCardOverview['status']> = {}
    ) =>
        ({
            status: { hasApplication: true, contractAddress: '0xc', coordinatorAddress: '0xd', ...status },
            balance: null,
            cards: [
                {
                    id: 'c1',
                    last4: '1234',
                    status: 'ACTIVE',
                    network: 'VISA',
                    issuedAt: '',
                    hasWithdrawApproval: false,
                    ...card,
                },
            ],
        }) as unknown as RainCardOverview

    test('an active card without the withdraw approval, once the contracts exist', () => {
        expect(cardNeedsSetup(overview({}))).toBe(true)
        expect(cardNeedsSetup(overview({ hasWithdrawApproval: true }))).toBe(false)
        expect(cardNeedsSetup(overview({ status: 'CANCELED' }))).toBe(false)
        expect(cardNeedsSetup(overview({}, { coordinatorAddress: undefined }))).toBe(false)
        expect(cardNeedsSetup(undefined)).toBe(false)
    })
})

describe('hasPostSignupRedirect', () => {
    test('matches the post-signup action patterns', () => {
        expect(hasPostSignupRedirect('/claim/abc')).toBe(true)
        expect(hasPostSignupRedirect('/alice/req?chargeId=1')).toBe(true)
        expect(hasPostSignupRedirect('/home')).toBe(false)
        expect(hasPostSignupRedirect(undefined)).toBe(false)
    })
})

describe('malformed consent responses', () => {
    test('read as nothing to accept rather than throwing', () => {
        expect(outdatedConsentVersions({ needsReConsent: true } as never)).toEqual([])
        expect(
            outdatedConsentVersions({ needsReConsent: true, documents: [null, {}, { slug: 'terms' }] } as never)
        ).toEqual([])
    })
})

describe('summarizeHistory', () => {
    const entry = (kind: string, timestamp: string, userRole = 'SENDER') =>
        ({ extraData: { kind }, timestamp: new Date(timestamp), userRole }) as never
    test('undefined while loading; the newest spend; a paid request of the user', () => {
        expect(summarizeHistory(undefined)).toEqual({ lastSpendAt: null, hasReceivedRequestPayment: undefined })
        expect(summarizeHistory([])).toEqual({ lastSpendAt: null, hasReceivedRequestPayment: false })
        const out = summarizeHistory([
            entry('P2P_SEND', '2026-10-10T00:00:00Z'),
            entry('CARD_SPEND', '2026-10-01T00:00:00Z'),
            entry('QR_PAY', '2026-10-05T00:00:00Z'),
            entry('REQUEST_PAY', '2026-09-01T00:00:00Z', 'RECIPIENT'),
        ])
        expect(out).toEqual({ lastSpendAt: '2026-10-05T00:00:00.000Z', hasReceivedRequestPayment: true })
        // paying someone else's request is not "someone paid mine"
        expect(
            summarizeHistory([entry('REQUEST_PAY', '2026-09-01T00:00:00Z', 'SENDER')]).hasReceivedRequestPayment
        ).toBe(false)
    })
})
