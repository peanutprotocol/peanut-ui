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

const enabledMantecaArRail = {
    id: 'rail-1',
    railId: 'rail-def-1',
    status: 'ENABLED',
    rail: {
        id: 'rail-def-1',
        provider: { code: 'MANTECA', name: 'Manteca' },
        method: { code: 'BANK_TRANSFER_AR', name: 'Bank Transfer AR', country: 'AR', currency: 'ARS' },
    },
}

function setUser(authUser: Record<string, unknown>) {
    mockUseAuth.mockReturnValue({
        user: authUser,
    } as unknown as ReturnType<typeof useAuth>)
}

describe('kyc withdrawal gating', () => {
    afterEach(() => jest.resetAllMocks())

    it('treats migrated SUMSUB ACTIVE Manteca rows as approved', () => {
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

    it('allows Argentina Manteca withdrawal when migrated KYC is country-scoped', () => {
        setUser({
            user: {
                bridgeKycStatus: null,
                kycVerifications: [
                    {
                        provider: 'SUMSUB',
                        mantecaGeo: 'AR',
                        status: 'ACTIVE',
                        updatedAt: '2026-03-17T14:47:34.702Z',
                    },
                ],
            },
            rails: [],
        })

        const { result } = renderHook(() => useIdentityVerification())

        expect(result.current.isVerifiedForCountry('AR')).toBe(true)
    })

    it('allows Argentina Manteca withdrawal for a normal active Manteca row', () => {
        setUser({
            user: {
                bridgeKycStatus: null,
                kycVerifications: [
                    {
                        provider: 'MANTECA',
                        mantecaGeo: 'AR',
                        status: 'ACTIVE',
                        updatedAt: '2025-10-30T01:12:06.099Z',
                    },
                ],
            },
            rails: [],
        })

        const { result } = renderHook(() => useIdentityVerification())

        expect(result.current.isVerifiedForCountry('AR')).toBe(true)
    })

    it('does not allow Argentina Manteca withdrawal from an enabled rail alone', () => {
        setUser({
            user: {
                bridgeKycStatus: null,
                kycVerifications: [],
            },
            rails: [enabledMantecaArRail],
        })

        const { result } = renderHook(() => useIdentityVerification())

        expect(result.current.isVerifiedForCountry('AR')).toBe(false)
    })
})
