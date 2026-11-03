/** @jest-environment jsdom */
import { renderHook } from '@testing-library/react'
import { withFeatureReport } from '@/test-utils/featureReport.fixture'
import { selectQrKycGate } from '@/features/payments/flows/qr-pay/qrKycGate.utils'
import { showVerifyCTA, blockedCardCtaId } from '@/utils/home-carousel.utils'
import { useCardSurfaceAccess } from '@/hooks/useCardSurfaceAccess'
import { cardOfferFacts } from '@/features/attention/journeyState'
import { cardOffer } from '@/features/attention/registry'
import { run } from '@/features/attention/__tests__/legacy-manager.fixture'
import type { IdentityVerificationStatus, RailCapability } from '@/types/capabilities'
import type { JourneyState } from '@/features/attention/types'

// The carousel was replaced by manager asks. Keep the original QR and card
// cases against the actual QR gate, card navigation gate, and manager verdicts.
let mockRails: RailCapability[] = []
let mockRestricted = false
let mockInfo = { geoProhibited: false }
jest.mock('@/hooks/useCardInfo', () => ({ useCardInfo: () => ({ cardInfo: mockInfo }) }))
jest.mock('@/hooks/useCapabilities', () => ({
    useCapabilities: () => ({ rails: mockRails, channelOf: (rail: RailCapability) => rail.channel }),
}))
jest.mock('@/hooks/useResidenceRestrictions', () => ({ useResidenceRestrictions: () => ({ card: mockRestricted }) }))
jest.mock('@/hooks/useIdentityVerification', () => ({ useIdentityVerification: () => ({ isTerminalFailure: false }) }))

function verifyOffered(identityStatus: IdentityVerificationStatus, regionRestricted = false) {
    const capabilities = withFeatureReport(
        { rails: mockRails, nextActions: [] },
        {
            identity: {
                status: regionRestricted ? 'failed' : identityStatus,
                ...(regionRestricted ? { reason: { code: 'identity_region_restricted' } } : {}),
            },
        }
    )
    const gate = selectQrKycGate({ isLoading: false, features: capabilities.features, nextActions: [] })
    return showVerifyCTA({
        qrGateState: gate.kycGateState,
        isIdentityVerified: identityStatus === 'verified',
        isInFlight: mockRails.some((rail) => rail.status === 'pending' || rail.status === 'requires-info'),
        isCardEligible: false,
    })
}
function managerAfterDismissal(verifyOpensQr: boolean, blockedId: string) {
    const result = run(
        { blockedCardId: blockedId, qr: { canPayNow: false, hasMadeQrPayment: false, verifyOpensQr } },
        {},
        {
            'blocked-card': { dismissedAt: new Date(0).toISOString(), version: blockedId },
        }
    )
    return result.trace.verdicts['verify-for-qr']
}
function cardOfferVerdict() {
    const access = renderHook(() => useCardSurfaceAccess()).result.current
    return cardOffer.eligible({
        userId: 'u1',
        userLoaded: true,
        activated: true,
        cardOffer: cardOfferFacts({
            loading: false,
            cardInfo: mockInfo,
            error: null,
            showCardSurface: access.showCardSurface,
            hasCardRelationship: access.hasCardRelationship,
            promotionDisabled: false,
        }),
    } as JourneyState)
}
beforeEach(() => {
    mockRails = []
    mockRestricted = false
    mockInfo = { geoProhibited: false }
})

describe('Home manager verify ask follows the QR-pay gate', () => {
    it('an unverified user who can verify gets the ask', () => {
        expect(verifyOffered('not_started')).toBe(true)
    })
    it('region refused, then dismissed blocked card, has no verification ask', () => {
        const id = blockedCardCtaId('region-restricted', 'identity_region_restricted')
        expect(managerAfterDismissal(verifyOffered('failed', true), id)).toBe('ineligible')
    })
    it('a blocked QR provider has no verification ask', () => {
        mockRails = [
            { id: 'manteca.pix_br', provider: 'manteca', channel: 'bank', status: 'blocked' } as RailCapability,
        ]
        expect(verifyOffered('not_started')).toBe(false)
    })
    it('a verified user who dismissed a provider rejection has no verification ask', () => {
        mockRails = [{ id: 'bridge.ach_us', provider: 'bridge', channel: 'bank', status: 'blocked' } as RailCapability]
        const id = blockedCardCtaId('verification-issue', 'provider_rejected')
        expect(managerAfterDismissal(verifyOffered('verified'), id)).toBe('ineligible')
    })
    it('a verified identity is never asked again even with no rail', () => {
        expect(verifyOffered('verified')).toBe(false)
    })
})
describe('Home manager card offer follows the navigation gate', () => {
    it('an activated user whose card is visible gets the offer', () => {
        expect(cardOfferVerdict()).toBe('show')
    })
    it('a residence restriction hides the offer even if the card country is not prohibited', () => {
        mockRestricted = true
        expect(cardOfferVerdict()).toBe('ineligible')
    })
})
