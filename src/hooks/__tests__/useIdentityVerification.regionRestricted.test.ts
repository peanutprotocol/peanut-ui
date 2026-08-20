import { renderHook } from '@testing-library/react'
import { useIdentityVerification } from '../useIdentityVerification'
import { type IdentityVerification } from '@/types/capabilities'

const mockUser = jest.fn()
jest.mock('@/context/authContext', () => ({
    useAuth: () => mockUser(),
}))

const withIdentity = (identityVerification?: IdentityVerification) => {
    mockUser.mockReturnValue({ user: identityVerification ? { identityVerification } : {}, isFetchingUser: false })
    return renderHook(() => useIdentityVerification()).result.current
}

const REGION = { code: 'identity_region_restricted', userMessage: 'nope' }

describe('useIdentityVerification — isRegionRestricted', () => {
    it('is true for a failed identity carrying the region code', () => {
        const r = withIdentity({ status: 'failed', reason: REGION })
        expect(r.isRegionRestricted).toBe(true)
        // strict subset of isFailed — never a replacement for it
        expect(r.isFailed).toBe(true)
    })

    it('is false for a failed identity with no reason (older backend, unclassified)', () => {
        const r = withIdentity({ status: 'failed' })
        expect(r.isFailed).toBe(true)
        expect(r.isRegionRestricted).toBe(false)
    })

    it('is false for a failed identity rejected for some other terminal cause', () => {
        const r = withIdentity({ status: 'failed', reason: { code: 'terminal_rejection', userMessage: 'nope' } })
        expect(r.isRegionRestricted).toBe(false)
    })

    it.each(['processing', 'action_required', 'verified', 'not_started'] as const)(
        'is false for %s even if a region reason somehow rides along',
        (status) => {
            // A reason on a non-terminal status would be the backend contradicting
            // itself. Rendering the dead-end screen on a live flow is the worse
            // failure, so the status gate wins.
            const r = withIdentity({ status, reason: REGION })
            expect(r.isRegionRestricted).toBe(false)
        }
    )

    it('is false while the user is still loading', () => {
        const r = withIdentity(undefined)
        expect(r.status).toBe('not_started')
        expect(r.isRegionRestricted).toBe(false)
    })
})
