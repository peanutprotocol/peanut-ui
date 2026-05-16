import { renderHook } from '@testing-library/react'
import useUnifiedKycStatus from '../useUnifiedKycStatus'

// mock authContext — the hook reads `user.user.bridgeKycStatus` + `user.user.kycVerifications`
jest.mock('@/context/authContext', () => ({
    useAuth: jest.fn(),
}))

import { useAuth } from '@/context/authContext'

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>

function withUser(partial: {
    bridgeKycStatus?: string | null
    kycVerifications?: Array<{
        provider: string
        status: string
        updatedAt?: string
        metadata?: Record<string, unknown>
        rejectLabels?: unknown
        rejectType?: string | null
    }>
}) {
    mockUseAuth.mockReturnValue({
        user: {
            user: {
                bridgeKycStatus: partial.bridgeKycStatus,
                kycVerifications: partial.kycVerifications ?? [],
            },
        },
    } as unknown as ReturnType<typeof useAuth>)
}

describe('useUnifiedKycStatus', () => {
    afterEach(() => jest.clearAllMocks())

    test('bridgeKycStatus="approved" → isBridgeApproved true, isBridgeUnderReview false', () => {
        // regression: post-2026-05-17 BE fix, a user whose `base` endorsement is approved
        // is reported as `bridge_kyc_status='approved'` even when rail-specific endorsements
        // are still incomplete. This hook MUST trust that signal.
        withUser({ bridgeKycStatus: 'approved' })
        const { result } = renderHook(() => useUnifiedKycStatus())
        expect(result.current.isBridgeApproved).toBe(true)
        expect(result.current.isBridgeUnderReview).toBe(false)
        expect(result.current.isKycApproved).toBe(true)
        expect(result.current.isKycInProgress).toBe(false)
    })

    test('bridgeKycStatus="under_review" → isBridgeUnderReview true', () => {
        withUser({ bridgeKycStatus: 'under_review' })
        const { result } = renderHook(() => useUnifiedKycStatus())
        expect(result.current.isBridgeApproved).toBe(false)
        expect(result.current.isBridgeUnderReview).toBe(true)
        expect(result.current.isKycInProgress).toBe(true)
    })

    test('bridgeKycStatus="incomplete" → isBridgeUnderReview true (also pending)', () => {
        withUser({ bridgeKycStatus: 'incomplete' })
        const { result } = renderHook(() => useUnifiedKycStatus())
        expect(result.current.isBridgeUnderReview).toBe(true)
    })

    test('bridgeKycStatus="rejected" → not approved, not under review', () => {
        withUser({ bridgeKycStatus: 'rejected' })
        const { result } = renderHook(() => useUnifiedKycStatus())
        expect(result.current.isBridgeApproved).toBe(false)
        expect(result.current.isBridgeUnderReview).toBe(false)
    })

    test('SUMSUB kycVerification APPROVED → isSumsubApproved true', () => {
        withUser({
            kycVerifications: [{ provider: 'SUMSUB', status: 'APPROVED', updatedAt: '2026-05-15T10:00:00Z' }],
        })
        const { result } = renderHook(() => useUnifiedKycStatus())
        expect(result.current.isSumsubApproved).toBe(true)
        expect(result.current.isKycApproved).toBe(true)
    })

    test('multiple SUMSUB verifications → uses most recently updated', () => {
        withUser({
            kycVerifications: [
                { provider: 'SUMSUB', status: 'REJECTED', updatedAt: '2026-05-10T10:00:00Z' },
                { provider: 'SUMSUB', status: 'APPROVED', updatedAt: '2026-05-15T10:00:00Z' },
            ],
        })
        const { result } = renderHook(() => useUnifiedKycStatus())
        expect(result.current.isSumsubApproved).toBe(true)
        expect(result.current.sumsubStatus).toBe('APPROVED')
    })

    test('MANTECA verification ACTIVE → isMantecaApproved true', () => {
        withUser({
            kycVerifications: [{ provider: 'MANTECA', status: 'ACTIVE' }],
        })
        const { result } = renderHook(() => useUnifiedKycStatus())
        expect(result.current.isMantecaApproved).toBe(true)
        expect(result.current.isKycApproved).toBe(true)
    })

    test('isKycApproved: any provider approved is enough', () => {
        withUser({
            bridgeKycStatus: 'rejected',
            kycVerifications: [{ provider: 'SUMSUB', status: 'APPROVED', updatedAt: '2026-05-15T10:00:00Z' }],
        })
        const { result } = renderHook(() => useUnifiedKycStatus())
        expect(result.current.isBridgeApproved).toBe(false)
        expect(result.current.isSumsubApproved).toBe(true)
        expect(result.current.isKycApproved).toBe(true)
    })

    test('sumsub ACTION_REQUIRED → isSumsubActionRequired true + isSumsubInProgress true', () => {
        withUser({
            kycVerifications: [{ provider: 'SUMSUB', status: 'ACTION_REQUIRED', updatedAt: '2026-05-15T10:00:00Z' }],
        })
        const { result } = renderHook(() => useUnifiedKycStatus())
        expect(result.current.isSumsubActionRequired).toBe(true)
        expect(result.current.isKycInProgress).toBe(true)
    })

    test('no user / undefined → all signals false', () => {
        mockUseAuth.mockReturnValue({ user: null } as unknown as ReturnType<typeof useAuth>)
        const { result } = renderHook(() => useUnifiedKycStatus())
        expect(result.current.isBridgeApproved).toBe(false)
        expect(result.current.isBridgeUnderReview).toBe(false)
        expect(result.current.isSumsubApproved).toBe(false)
        expect(result.current.isMantecaApproved).toBe(false)
        expect(result.current.isKycApproved).toBe(false)
    })
})
