import { renderHook } from '@testing-library/react'
import { useIdentityVerification } from '../useIdentityVerification'
import useUnifiedKycStatus from '../useUnifiedKycStatus'

jest.mock('@/assets', () => ({
    EUROPE_GLOBE_ICON: 'europe',
    LATAM_GLOBE_ICON: 'latam',
    NORTH_AMERICA_GLOBE_ICON: 'north-america',
    REST_OF_WORLD_GLOBE_ICON: 'rest-of-world',
}))

jest.mock('@/components/AddMoney/consts', () => ({
    BRIDGE_ALPHA3_TO_ALPHA2: { USA: 'US' },
    MantecaSupportedExchanges: { AR: 'ARGENTINA', BR: 'BRAZIL' },
    countryData: [
        { id: 'AR', type: 'country', title: 'Argentina', path: 'argentina', iso2: 'AR' },
        { id: 'US', type: 'country', title: 'United States', path: 'united-states', iso2: 'US' },
    ],
}))

jest.mock('@/context/authContext', () => ({
    useAuth: jest.fn(),
}))

import { useAuth } from '@/context/authContext'

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>

// ENABLED Manteca AR rail with no mantecaUserId — a "QR-tier" rail. Enough to
// pay QR via the corporate pool, but NOT to deposit / withdraw.
const qrTierMantecaArRail = {
    id: 'rail-qr',
    railId: 'rail-def-1',
    status: 'ENABLED',
    metadata: null,
    rail: {
        id: 'rail-def-1',
        provider: { code: 'MANTECA', name: 'Manteca' },
        method: { code: 'BANK_TRANSFER_AR', name: 'Bank Transfer AR', country: 'AR', currency: 'ARS' },
    },
}

// Same rail, ENABLED and carrying a mantecaUserId — "full-tier", real Manteca KYC.
const fullTierMantecaArRail = {
    ...qrTierMantecaArRail,
    id: 'rail-full',
    metadata: { mantecaUserId: '2414354' },
}

function setUser(authUser: Record<string, unknown>) {
    mockUseAuth.mockReturnValue({
        user: authUser,
    } as unknown as ReturnType<typeof useAuth>)
}

describe('kyc withdrawal gating', () => {
    afterEach(() => jest.resetAllMocks())

    it('treats migrated SUMSUB ACTIVE Manteca rows as approved (useUnifiedKycStatus)', () => {
        setUser({
            user: {
                bridgeKycStatus: null,
                kycVerifications: [
                    {
                        provider: 'SUMSUB',
                        mantecaGeo: 'AR',
                        status: 'ACTIVE',
                        updatedAt: '2026-03-26T23:02:30.330Z',
                    },
                ],
            },
            rails: [],
        })

        const { result } = renderHook(() => useUnifiedKycStatus())

        expect(result.current.isSumsubApproved).toBe(true)
        expect(result.current.isMantecaApproved).toBe(true)
        expect(result.current.isKycApproved).toBe(true)
    })

    // Phase 6 (rail-gating): isVerifiedForCountry — the deposit / withdraw gate —
    // is now derived from rails, and requires a *full-tier* Manteca rail.
    it('isVerifiedForCountry(AR) is true with a full-tier Manteca rail (ENABLED + mantecaUserId)', () => {
        setUser({
            user: { bridgeKycStatus: null, kycVerifications: [] },
            rails: [fullTierMantecaArRail],
        })

        const { result } = renderHook(() => useIdentityVerification())

        expect(result.current.isVerifiedForCountry('AR')).toBe(true)
    })

    it('isVerifiedForCountry(AR) is false from a QR-tier rail alone (ENABLED, no mantecaUserId)', () => {
        setUser({
            user: { bridgeKycStatus: null, kycVerifications: [] },
            rails: [qrTierMantecaArRail],
        })

        const { result } = renderHook(() => useIdentityVerification())

        expect(result.current.isVerifiedForCountry('AR')).toBe(false)
    })

    it('isVerifiedForCountry(AR) is false with no Manteca rail', () => {
        setUser({
            user: { bridgeKycStatus: null, kycVerifications: [] },
            rails: [],
        })

        const { result } = renderHook(() => useIdentityVerification())

        expect(result.current.isVerifiedForCountry('AR')).toBe(false)
    })
})
