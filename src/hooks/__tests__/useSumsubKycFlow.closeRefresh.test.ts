jest.mock('@/utils/native-platform', () => require('@/test-utils/native-platform-mock').createNativePlatformMock())

import { getKycDocumentPlan, resumeKycDocumentAttempt, refreshKycIdentityStatus } from '@/app/actions/kyc-workflow'
import { act, waitFor } from '@testing-library/react'
import { renderHookWithIntl as renderHook } from '@/test-utils/intl'
import { useSumsubKycFlow } from '@/hooks/useSumsubKycFlow'
import { initiateSumsubKyc, startKycAction, startResidenceChangeVerification } from '@/app/actions/sumsub'

jest.mock('@/app/actions/kyc-workflow', () => {
    const getKycDocumentPlan = jest.fn(async () => ({ available: false, routes: [] }))
    return {
        getKycDocumentStatus: jest.fn(async () => 'IN_REVIEW'),
        refreshKycIdentityStatus: jest.fn(async () => undefined),
        getKycDocumentPlan,
        findKycDocumentPlan: jest.fn(() => getKycDocumentPlan().catch(() => null)),
        resumeKycDocumentAttempt: jest.fn(),
        findKycReplacementPlan: jest.fn(async () => null),
    }
})

const mockWs: { handler?: (status: string, labels?: string[]) => void } = {}
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
jest.mock('@/utils/api-fetch', () => ({ serverFetch: jest.fn() }))

jest.mock('@/hooks/useWebSocket', () => ({
    useWebSocket: (opts: { onSumsubKycStatusUpdate?: (status: string, labels?: string[]) => void }) => {
        mockWs.handler = opts.onSumsubKycStatusUpdate
    },
}))
let mockUserId = 'owner-A'
let mockDemo = false
jest.mock('@/utils/demo', () => ({ isDemoMode: () => mockDemo }))
jest.mock('@/context/authContext', () => ({
    useAuth: () => ({ user: { user: { userId: mockUserId, username: mockUserId } } }),
}))
const mockRouterPush = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: mockRouterPush, replace: jest.fn() }) }))
jest.mock('@/utils/capacitor', () => ({ isCapacitor: () => false }))

const mockInitiate = initiateSumsubKyc as jest.MockedFunction<typeof initiateSumsubKyc>
const mockIdentityRefresh = jest.mocked(refreshKycIdentityStatus)
const pending = <T>() => {
    let resolve!: (value: T) => void
    const promise = new Promise<T>((done) => {
        resolve = done
    })
    return { promise, resolve }
}

describe('SDK close identity recovery', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockUserId = 'owner-A'
        mockDemo = false
        jest.mocked(getKycDocumentPlan).mockResolvedValue({ available: false, routes: [] } as never)
        mockIdentityRefresh.mockResolvedValue(undefined)
        mockInitiate.mockResolvedValue({ data: { token: 'initial', applicantId: 'app', status: 'NOT_STARTED' } })
    })

    it('refreshes once after an unsubmitted close, then refetches identity without reopening or completing', async () => {
        const refresh = pending<undefined>()
        mockIdentityRefresh.mockReturnValue(refresh.promise)
        const onKycSuccess = jest.fn()
        const { result } = renderHook(() => useSumsubKycFlow({ onKycSuccess, regionIntent: 'ROW' }))
        await act(async () => {
            await result.current.handleInitiateKyc('ROW')
        })
        expect(result.current.showWrapper).toBe(true)
        mockInitiate.mockClear()
        mockInitiate.mockResolvedValue({ data: { token: 'do-not-open', applicantId: 'app', status: 'APPROVED' } })
        act(() => {
            result.current.handleClose()
            result.current.handleClose()
        })
        expect(result.current.showWrapper).toBe(false)
        expect(mockIdentityRefresh).toHaveBeenCalledTimes(1)
        expect(mockInitiate).not.toHaveBeenCalled()
        await act(async () => {
            refresh.resolve(undefined)
        })
        expect(mockInitiate).toHaveBeenCalledTimes(1)
        expect(result.current.liveKycStatus).toBe('APPROVED')
        expect(result.current.showWrapper).toBe(false)
        expect(result.current.accessToken).toBe('initial')
        expect(onKycSuccess).not.toHaveBeenCalled()
    })

    it('does not refresh an SDK session already completed by submission', async () => {
        const { result } = renderHook(() => useSumsubKycFlow())
        await act(async () => {
            await result.current.handleInitiateKyc('ROW')
        })
        act(() => {
            result.current.handleSdkComplete()
            result.current.handleClose()
        })
        expect(mockIdentityRefresh).not.toHaveBeenCalled()
    })

    it('does not publish a stale close refresh over a newly opened SDK', async () => {
        const refresh = pending<undefined>()
        mockIdentityRefresh.mockReturnValue(refresh.promise)
        const { result } = renderHook(() => useSumsubKycFlow({ regionIntent: 'ROW' }))
        await act(async () => {
            await result.current.handleInitiateKyc('ROW')
        })
        act(() => {
            result.current.handleClose()
        })
        await act(async () => {
            await result.current.handleInitiateKyc('ROW')
        })
        mockInitiate.mockClear()
        await act(async () => {
            refresh.resolve(undefined)
        })
        expect(mockInitiate).not.toHaveBeenCalled()
        expect(result.current.showWrapper).toBe(true)
    })

    it('does not refresh a submitted multi-level session that closes before completion', async () => {
        const { result } = renderHook(() => useSumsubKycFlow())
        await act(async () => {
            await result.current.handleInitiateKyc('EU')
        })
        expect(result.current.showWrapper).toBe(true)
        jest.mocked(refreshKycIdentityStatus).mockClear()
        act(() => {
            result.current.handleSdkSubmitted()
            result.current.handleClose()
        })
        expect(refreshKycIdentityStatus).not.toHaveBeenCalled()
        expect(result.current.showWrapper).toBe(false)
    })
})

describe('K1 scoped close synchronization and K2 drawer handoff', () => {
    const legacyPlan = { available: false, routes: [] }
    const session = {
        attemptId: 'attempt-1',
        token: 'document-token',
        applicantId: 'app',
        levelName: 'shared',
        status: 'COLLECTING',
        sdkConfig: {
            documentDefinitions: { IDENTITY: { country: 'PRT', idDocType: 'PASSPORT' } },
            autoSelectDocumentDefinitions: true as const,
        },
    }
    beforeEach(() => {
        jest.clearAllMocks()
        mockUserId = 'owner-A'
        mockDemo = false
        jest.mocked(getKycDocumentPlan).mockResolvedValue(legacyPlan as never)
        mockIdentityRefresh.mockResolvedValue(undefined)
        mockInitiate.mockResolvedValue({ data: { token: 'initial', applicantId: 'app', status: 'NOT_STARTED' } })
    })

    it('K1 preserves the hook status scope when the SDK closes', async () => {
        const scope = {
            regionIntent: 'LATAM' as const,
            corridor: 'BANK_TRANSFER_AR' as const,
            levelName: 'manteca-kyc',
            targetCountry: 'AR',
        }
        const { result } = renderHook(() => useSumsubKycFlow({ regionIntent: scope.regionIntent }))
        await waitFor(() => expect(mockInitiate).toHaveBeenCalled())
        await act(async () => {
            await result.current.handleInitiateKyc(
                'LATAM',
                scope.levelName,
                false,
                scope.targetCountry,
                false,
                scope.corridor
            )
        })
        mockInitiate.mockClear()
        await act(async () => {
            result.current.handleClose()
        })
        expect(mockIdentityRefresh).toHaveBeenCalledTimes(1)
        expect(mockInitiate).toHaveBeenCalledTimes(1)
        expect(mockInitiate).toHaveBeenCalledWith(scope)
        expect(result.current.showWrapper).toBe(false)
    })

    it('K1 skips legacy synchronization without a hook region intent', async () => {
        const { result } = renderHook(() => useSumsubKycFlow())
        await act(async () => {
            await result.current.handleInitiateKyc('ROW')
        })
        mockInitiate.mockClear()
        await act(async () => {
            result.current.handleClose()
        })
        expect(mockInitiate).not.toHaveBeenCalled()
        expect(result.current.showWrapper).toBe(false)
    })

    it('K1 rechecks the plan before close synchronization and protects Smart Paperwork', async () => {
        const { result } = renderHook(() => useSumsubKycFlow({ regionIntent: 'ROW' }))
        await waitFor(() => expect(mockInitiate).toHaveBeenCalled())
        await act(async () => {
            await result.current.handleInitiateKyc()
        })
        jest.mocked(getKycDocumentPlan).mockResolvedValue({
            ...legacyPlan,
            available: true,
            flow: 'verify-once',
        } as never)
        mockInitiate.mockClear()
        await act(async () => {
            result.current.handleClose()
        })
        expect(mockInitiate).not.toHaveBeenCalled()
        expect(result.current.showWrapper).toBe(false)
    })

    it('K1 discards an old account close refresh after account replacement', async () => {
        const refresh = pending<undefined>()
        const { result, rerender } = renderHook(() => useSumsubKycFlow({ regionIntent: 'ROW' }))
        await waitFor(() => expect(mockInitiate).toHaveBeenCalled())
        await act(async () => {
            await result.current.handleInitiateKyc()
        })
        mockIdentityRefresh.mockReturnValue(refresh.promise)
        act(() => {
            result.current.handleClose()
        })
        mockUserId = 'owner-B'
        await act(async () => {
            rerender()
        })
        mockInitiate.mockClear()
        await act(async () => {
            refresh.resolve(undefined)
        })
        expect(mockInitiate).not.toHaveBeenCalled()
    })

    it('K2 returns true for successful demo verification', async () => {
        mockDemo = true
        const onKycSuccess = jest.fn()
        const { result } = renderHook(() => useSumsubKycFlow({ onKycSuccess }))
        await act(async () => {
            expect(await result.current.handleInitiateKyc('LATAM')).toBe(true)
        })
        expect(onKycSuccess).toHaveBeenCalledTimes(1)
        expect(mockInitiate).not.toHaveBeenCalled()
    })

    it.each(['resume', 'response'] as const)(
        'K2 returns true when %s opens the document SDK; K1 does not sync identity on close',
        async (mode) => {
            if (mode === 'resume') {
                jest.mocked(getKycDocumentPlan).mockResolvedValue({
                    ...legacyPlan,
                    activeAttemptId: 'attempt-1',
                } as never)
                jest.mocked(resumeKycDocumentAttempt).mockResolvedValue(session as never)
            } else {
                mockInitiate.mockResolvedValue({ data: session } as never)
            }
            const { result } = renderHook(() => useSumsubKycFlow())
            await act(async () => {
                expect(await result.current.handleInitiateKyc('LATAM')).toBe(true)
            })
            expect(result.current.showWrapper).toBe(true)
            expect(result.current.accessToken).toBe('document-token')
            expect(result.current.documentConfig).toEqual(session.sdkConfig)
            mockInitiate.mockClear()
            await act(async () => {
                result.current.handleClose()
            })
            expect(mockIdentityRefresh).not.toHaveBeenCalled()
            expect(mockInitiate).not.toHaveBeenCalled()
        }
    )

    it('K2 returns false when resuming the document attempt fails', async () => {
        jest.mocked(getKycDocumentPlan).mockResolvedValue({ ...legacyPlan, activeAttemptId: 'attempt-1' } as never)
        jest.mocked(resumeKycDocumentAttempt).mockRejectedValue(new Error('Resume unavailable'))
        const { result } = renderHook(() => useSumsubKycFlow())
        await act(async () => {
            expect(await result.current.handleInitiateKyc('LATAM')).toBe(false)
        })
        expect(result.current.showWrapper).toBe(false)
        expect(result.current.error).toBeTruthy()
    })

    it('K2 returns false when initiation fails', async () => {
        mockInitiate.mockResolvedValue({ error: 'Initiation unavailable' })
        const { result } = renderHook(() => useSumsubKycFlow())
        await act(async () => {
            expect(await result.current.handleInitiateKyc('LATAM')).toBe(false)
        })
        expect(result.current.showWrapper).toBe(false)
        expect(result.current.error).toBeTruthy()
    })

    it.each(['action', 'residence'] as const)('K1 skips identity close refresh for %s SDK sessions', async (mode) => {
        jest.mocked(startKycAction).mockResolvedValue({
            data: { token: 'action-token', levelName: 'provider-rfi-proof-of-address' },
        })
        jest.mocked(startResidenceChangeVerification).mockResolvedValue({
            data: { token: 'residence-token', applicantId: 'app', levelName: 'general' },
        } as never)
        const { result } = renderHook(() => useSumsubKycFlow({ regionIntent: 'ROW' }))
        await waitFor(() => expect(mockInitiate).toHaveBeenCalled())
        await act(async () => {
            if (mode === 'action') await result.current.handleStartAction('provider-rfi-proof-of-address')
            else await result.current.handleResidenceChange('PT')
        })
        expect(result.current.showWrapper).toBe(true)
        mockInitiate.mockClear()
        await act(async () => {
            result.current.handleClose()
        })
        expect(mockIdentityRefresh).not.toHaveBeenCalled()
        expect(mockInitiate).not.toHaveBeenCalled()
    })
})
