/**
 * A one-shot session (TASK-23329, item 9a) runs on the level the token from
 * POST /users/identity is bound to, and stays on it. The app names no level:
 * the server picks it from the declared residence and pins it on the row. The
 * level is standalone (`workflow.isMultiLevel: false`, whatever the intent
 * would imply on `general`), and a token refresh repeats the same request,
 * never an action or session route, so the applicant and the level are kept.
 */
import { act } from '@testing-library/react'
import { renderHookWithIntl as renderHook } from '@/test-utils/intl'
import { useSumsubKycFlow } from '@/hooks/useSumsubKycFlow'
import {
    initiateSumsubKyc,
    initiateSelfHealResubmission,
    refreshVerificationSession,
    startKycAction,
} from '@/app/actions/sumsub'

jest.mock('@/app/actions/sumsub', () => ({
    ...jest.requireActual('@/app/actions/sumsub'),
    initiateSumsubKyc: jest.fn(),
    initiateSelfHealResubmission: jest.fn(),
    restartIdentityVerification: jest.fn(),
    startResidenceChangeVerification: jest.fn(),
    startKycAction: jest.fn(),
    refreshVerificationSession: jest.fn(),
    getVerificationSession: jest.fn(async () => null),
}))
jest.mock('@/hooks/useWebSocket', () => ({ useWebSocket: () => {} }))
jest.mock('@/context/authContext', () => ({
    useAuth: () => ({
        user: { user: { username: 'test' }, identityVerification: { status: 'not_started', oneShot: true } },
    }),
}))
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn(), replace: jest.fn() }) }))
jest.mock('@/utils/capacitor', () => ({ isCapacitor: () => false }))

const mockInitiate = initiateSumsubKyc as jest.MockedFunction<typeof initiateSumsubKyc>

// the item 3 answer for a Brazilian resident: a token for `one-shot-latam`, a standalone level
const oneShotAnswer = (token: string) => ({
    data: {
        token,
        applicantId: 'applicant-one-shot',
        status: 'NOT_STARTED' as const,
        workflow: { regionIntent: 'LATAM' as const, isMultiLevel: false },
    },
})

describe('useSumsubKycFlow — one-shot session', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('opens the level the server answered with as single-level, whatever the intent implies', async () => {
        mockInitiate.mockResolvedValueOnce(oneShotAnswer('tok-one-shot'))
        const { result } = renderHook(() => useSumsubKycFlow())

        await act(async () => {
            await result.current.handleInitiateKyc()
        })

        expect(result.current.showWrapper).toBe(true)
        expect(result.current.accessToken).toBe('tok-one-shot')
        // LATAM reads as multi-level on `general`; a one-shot level has no follow-up level
        expect(result.current.isMultiLevel).toBe(false)
        expect(result.current.isActionFlow).toBe(false)
    })

    it('refreshes the token through the same request, never an action or session route', async () => {
        mockInitiate
            .mockResolvedValueOnce(oneShotAnswer('tok-one-shot'))
            .mockResolvedValueOnce(oneShotAnswer('tok-refreshed'))
        const { result } = renderHook(() => useSumsubKycFlow())
        await act(async () => {
            await result.current.handleInitiateKyc()
        })

        let refreshed: string | undefined
        await act(async () => {
            refreshed = await result.current.refreshToken()
        })

        expect(refreshed).toBe('tok-refreshed')
        expect(result.current.accessToken).toBe('tok-refreshed')
        expect(mockInitiate).toHaveBeenCalledTimes(2)
        // no corridor, no level and no country in the request: the row holds the level
        expect(mockInitiate).toHaveBeenLastCalledWith({
            corridor: undefined,
            regionIntent: 'LATAM',
            levelName: undefined,
            targetCountry: undefined,
        })
        expect(refreshVerificationSession).not.toHaveBeenCalled()
        expect(startKycAction).not.toHaveBeenCalled()
        expect(initiateSelfHealResubmission).not.toHaveBeenCalled()
        expect(result.current.showWrapper).toBe(true)
    })

    it('reopening after a manual close asks the same route again, so the applicant is reused', async () => {
        mockInitiate.mockResolvedValue(oneShotAnswer('tok-one-shot'))
        const { result } = renderHook(() => useSumsubKycFlow())
        await act(async () => {
            await result.current.handleInitiateKyc()
        })
        act(() => result.current.handleClose())
        expect(result.current.showWrapper).toBe(false)

        await act(async () => {
            await result.current.handleInitiateKyc()
        })

        expect(result.current.showWrapper).toBe(true)
        expect(mockInitiate).toHaveBeenCalledTimes(2)
        expect(mockInitiate.mock.calls[1]).toEqual(mockInitiate.mock.calls[0])
    })
})
