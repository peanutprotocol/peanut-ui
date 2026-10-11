import {
    buildJourneyState,
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
    consentVersions: [],
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
    redirectDestination: undefined,
    balanceUnits: undefined,
    migrationOn: false,
    pushReady: false,
    pushUnanswered: false,
    showEarlyUserModal: undefined,
}

describe('buildJourneyState', () => {
    test('native trailing-slash Home is Home', () => {
        expect(buildJourneyState(base).route).toBe('home')
        expect(buildJourneyState({ ...base, pathname: '/profile' }).route).toBe('other')
    })

    test('consent: loading is unknown, a failed check fails open, documents mean needed', () => {
        expect(buildJourneyState({ ...base, consentVersions: undefined }).consent.status).toBe('unknown')
        expect(buildJourneyState({ ...base, consentVersions: undefined, consentFailed: true }).consent.status).toBe(
            'clear'
        )
        expect(buildJourneyState({ ...base, consentVersions: ['2026-10-01'] }).consent).toEqual({
            status: 'needed',
            versions: ['2026-10-01'],
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
