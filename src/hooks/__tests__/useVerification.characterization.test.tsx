import { renderHook } from '@testing-library/react'
import { useAuth } from '@/context/authContext'
import { useVerification } from '@/hooks/useVerification'
import type { IUserProfile } from '@/interfaces/interfaces'
import type { IdentityVerification, RailCapability } from '@/types/capabilities'

jest.mock('@/context/authContext', () => ({ useAuth: jest.fn() }))
let mockDemoMode = false
jest.mock('@/utils/demo', () => ({ ...jest.requireActual('@/utils/demo'), isDemoMode: () => mockDemoMode }))

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>

function verifyFor(rails: RailCapability[], identity?: IdentityVerification) {
    mockUseAuth.mockReturnValue({
        user: {
            ...(identity ? { identityVerification: identity } : {}),
            capabilities: { rails, nextActions: [], restrictions: [] },
        } as unknown as IUserProfile,
        isFetchingUser: false,
    } as unknown as ReturnType<typeof useAuth>)
    const { result, unmount } = renderHook(() => useVerification())
    const snapshot = result.current
    unmount()
    return snapshot
}

describe('useVerification', () => {
    beforeEach(() => {
        mockDemoMode = false
    })

    it('separates identityVerified from hasAnyEnabledRail', () => {
        const res = verifyFor(
            [
                {
                    id: 'bridge.ach_us',
                    provider: 'bridge',
                    method: 'ACH_US',
                    channel: 'bank',
                    country: 'US',
                    currency: 'USD',
                    status: 'pending',
                },
            ],
            { status: 'verified' }
        )
        expect(res.identityVerified).toBe(true)
        expect(res.hasAnyEnabledRail).toBe(false)
    })

    it('treats demo mode as hasAnyEnabledRail without faking identityVerified', () => {
        mockDemoMode = true
        const res = verifyFor([], { status: 'not_started' })
        expect(res.hasAnyEnabledRail).toBe(true)
        expect(res.identityVerified).toBe(false)
    })

    it('honors per-operation splits on Manteca countries and falls back to bank status elsewhere', () => {
        const poolRail: RailCapability = {
            id: 'manteca.pix_br',
            provider: 'manteca',
            method: 'PIX_BR',
            channel: 'bank',
            country: 'BR',
            currency: 'BRL',
            status: 'enabled',
            operations: { pay: 'enabled', deposit: 'requires-info', withdraw: 'requires-info' },
        }
        const res = verifyFor([poolRail])
        expect(res.canUse('pay', 'BR')).toBe(true)
        expect(res.canUse('withdraw', 'BR')).toBe(false)
        expect(res.canUse('deposit', 'br')).toBe(false)
        expect(res.canUse('withdraw', 'US')).toBe(true)
    })
})
