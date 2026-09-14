import { renderHook } from '@testing-library/react'
import { useIdentityVerification } from '../useIdentityVerification'
import { type IdentityVerification } from '@/types/capabilities'

const mockUser = jest.fn()
jest.mock('@/context/authContext', () => ({
    useAuth: () => mockUser(),
}))

const withIdentity = (identityVerification?: IdentityVerification, isFetchingUser = false) => {
    mockUser.mockReturnValue({ user: identityVerification ? { identityVerification } : {}, isFetchingUser })
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
        const r = withIdentity(undefined, true)
        expect(r.isLoading).toBe(true)
        expect(r.status).toBe('not_started')
        expect(r.isRegionRestricted).toBe(false)
    })
})

describe('useIdentityVerification — isTerminalFailure', () => {
    it('is true for a decision the user cannot retry', () => {
        const r = withIdentity({ status: 'failed', canRetry: false })
        expect(r.isTerminalFailure).toBe(true)
    })

    it('is false when the check merely errored — a retry is worth offering', () => {
        const r = withIdentity({ status: 'failed', canRetry: true })
        expect(r.isFailed).toBe(true)
        expect(r.isTerminalFailure).toBe(false)
    })

    it('defaults to terminal when an older backend omits canRetry', () => {
        // Fail-closed on purpose: offering a retry that cannot pass is worse than
        // a support link that was not strictly needed. This is also what makes
        // the terminal fix land even if the FE ships ahead of the BE.
        const r = withIdentity({ status: 'failed' })
        expect(r.isTerminalFailure).toBe(true)
    })

    it('is false for region-restricted — that gets its own screen, with no support link', () => {
        const r = withIdentity({ status: 'failed', canRetry: false, reason: REGION })
        expect(r.isRegionRestricted).toBe(true)
        expect(r.isTerminalFailure).toBe(false)
    })

    it.each(['processing', 'action_required', 'verified', 'not_started'] as const)('is false for %s', (status) => {
        expect(withIdentity({ status, canRetry: false }).isTerminalFailure).toBe(false)
    })
})
