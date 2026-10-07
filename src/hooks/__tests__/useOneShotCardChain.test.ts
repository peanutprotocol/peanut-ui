/**
 * The card step beside the identity check (TASK-23329, item 9b): every answer
 * of `POST /rain/cards` moves the step, a token opens the SDK, the agreements
 * are echoed on acceptance, and a user who leaves keeps the step open.
 */
import { act } from '@testing-library/react'
import { renderHookWithIntl as renderHook } from '@/test-utils/intl'
import { useOneShotCardChain } from '@/hooks/useOneShotCardChain'
import { pollUntilApplyAdvances, pollUntilReady } from '@/components/Card/cardApply.utils'
import { ApiError } from '@/services/api-error'
import { rainApi } from '@/services/rain'

jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))
jest.mock('@/services/rain', () => ({
    rainApi: { applyForCard: jest.fn(), getCardApplyReadiness: jest.fn() },
}))
jest.mock('@/components/Card/cardApply.utils', () => ({
    pollUntilReady: jest.fn(),
    pollUntilApplyAdvances: jest.fn(),
}))

const mockApply = rainApi.applyForCard as jest.MockedFunction<typeof rainApi.applyForCard>
const mockReady = pollUntilReady as jest.MockedFunction<typeof pollUntilReady>
const mockAdvance = pollUntilApplyAdvances as jest.MockedFunction<typeof pollUntilApplyAdvances>

const INCOMPLETE = {
    status: 'incomplete' as const,
    missing: [],
    questionnaireComplete: false,
    sumsubAccessToken: 'tok-questions',
}
const TERMS = { status: 'terms-required' as const, isUsResident: false, termsVersion: '2026-06-01' }
const PENDING_IDENTITY = { status: 'pending-identity' as const, message: 'later' }

const refused = (status: number, code: string, reason?: string) =>
    new ApiError('refused', { status, code, cause: { status: 'error', code, message: 'refused', reason } })

describe('useOneShotCardChain', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('start: the open questions give a token, which opens the SDK', async () => {
        mockApply.mockResolvedValue(INCOMPLETE)
        const { result } = renderHook(() => useOneShotCardChain())
        await act(() => result.current.start())
        expect(mockApply).toHaveBeenCalledWith({ termsAccepted: false })
        expect(result.current.chain).toEqual({ kind: 'questions', token: 'tok-questions' })
        expect(result.current.token).toBe('tok-questions')
        expect(result.current.isForeground).toBe(true)
    })

    it('start: the agreements show at once and step in front of the drawer', async () => {
        mockApply.mockResolvedValue(TERMS)
        const { result } = renderHook(() => useOneShotCardChain())
        await act(() => result.current.start())
        expect(result.current.chain).toEqual({ kind: 'agreements', isUsResident: false })
        expect(result.current.token).toBeNull()
        expect(result.current.showTerms).toBe(true)
        expect(result.current.isForeground).toBe(true)
    })

    it('the agreements can be put aside and resumed from the row without a new request', async () => {
        mockApply.mockResolvedValue(TERMS)
        const { result } = renderHook(() => useOneShotCardChain())
        await act(() => result.current.start())
        act(() => result.current.dismissTerms())
        expect(result.current.isForeground).toBe(false)
        expect(result.current.chain?.kind).toBe('agreements')
        await act(() => result.current.resume())
        expect(result.current.showTerms).toBe(true)
        expect(mockApply).toHaveBeenCalledTimes(1)
    })

    it('accepting echoes the international documents and reads setting up on pending-identity', async () => {
        mockApply.mockResolvedValueOnce(TERMS).mockResolvedValueOnce(PENDING_IDENTITY)
        const { result } = renderHook(() => useOneShotCardChain())
        await act(() => result.current.start())
        await act(() => result.current.acceptTerms())
        const [, acceptance] = mockApply.mock.calls
        expect(acceptance[0]).toMatchObject({ termsAccepted: true })
        expect(acceptance[0]?.acceptedDocuments?.map((doc) => doc.slug)).toEqual([
            'card-terms-international',
            'card-esign',
        ])
        expect(result.current.chain).toEqual({ kind: 'setting-up' })
        expect(result.current.isForeground).toBe(false)
    })

    it('a US resident echoes the US documents', async () => {
        mockApply.mockResolvedValueOnce({ ...TERMS, isUsResident: true }).mockResolvedValueOnce(PENDING_IDENTITY)
        const { result } = renderHook(() => useOneShotCardChain())
        await act(() => result.current.start())
        await act(() => result.current.acceptTerms())
        expect(mockApply.mock.calls[1][0]?.acceptedDocuments?.map((doc) => doc.slug)).toEqual([
            'card-terms-us',
            'card-esign',
            'card-privacy',
        ])
    })

    it.each([
        [refused(403, 'provider-not-in-plan', 'document_country_unsupported'), { kind: 'needs-local-id' }],
        [refused(409, 'application-outcome-unknown'), { kind: 'checking' }],
        [refused(422, 'occupation-not-accepted'), { kind: 'occupation-not-accepted' }],
        [new Error('network down'), { kind: 'error', message: 'network down' }],
    ])('a refused or failed request maps to its state: %s', async (error, expected) => {
        mockApply.mockRejectedValue(error)
        const { result } = renderHook(() => useOneShotCardChain())
        await act(() => result.current.start())
        expect(result.current.chain).toEqual(expected)
        expect(result.current.token).toBeNull()
        expect(result.current.isBusy).toBe(false)
    })

    it('after the questions: waits for the readiness stamp, asks again and shows the agreements', async () => {
        mockApply.mockResolvedValueOnce(INCOMPLETE)
        mockReady.mockResolvedValue(true)
        mockAdvance.mockResolvedValue(TERMS)
        const { result } = renderHook(() => useOneShotCardChain())
        await act(() => result.current.start())
        await act(() => result.current.handleSdkComplete())
        expect(mockReady).toHaveBeenCalledWith(expect.objectContaining({ intervalMs: 1000, timeoutMs: 30000 }))
        expect(result.current.token).toBeNull()
        expect(result.current.chain).toEqual({ kind: 'agreements', isUsResident: false })
        expect(result.current.isBusy).toBe(false)
    })

    it('after a missing identity step: asks the route again with no readiness poll, and follows', async () => {
        const MAIN = {
            status: 'main-kyc-required' as const,
            missingDocTypes: ['SELFIE'],
            sumsubAccessToken: 'tok-main',
        }
        mockApply.mockResolvedValueOnce(MAIN).mockResolvedValueOnce(INCOMPLETE)
        const { result } = renderHook(() => useOneShotCardChain())
        await act(() => result.current.start())
        expect(result.current.chain).toEqual({ kind: 'identity-step', token: 'tok-main' })
        await act(() => result.current.handleSdkComplete())
        // the card action's review writes the stamp, not the identity step: never wait for it
        expect(mockReady).not.toHaveBeenCalled()
        expect(mockAdvance).not.toHaveBeenCalled()
        expect(mockApply).toHaveBeenCalledTimes(2)
        expect(result.current.chain).toEqual({ kind: 'questions', token: 'tok-questions' })
        expect(result.current.token).toBe('tok-questions')
        expect(result.current.isBusy).toBe(false)
    })

    it('after the questions: a readiness stamp that never comes is a slow-verification error', async () => {
        mockApply.mockResolvedValueOnce(INCOMPLETE)
        mockReady.mockResolvedValue(false)
        const { result } = renderHook(() => useOneShotCardChain())
        await act(() => result.current.start())
        await act(() => result.current.handleSdkComplete())
        expect(mockAdvance).not.toHaveBeenCalled()
        expect(result.current.chain?.kind).toBe('error')
    })

    it('leaving the SDK keeps the step open: the row and the Home card can resume it', async () => {
        mockApply.mockResolvedValue(INCOMPLETE)
        const { result } = renderHook(() => useOneShotCardChain())
        await act(() => result.current.start())
        act(() => result.current.handleSdkClose())
        expect(result.current.token).toBeNull()
        expect(result.current.chain).toEqual({ kind: 'questions', token: 'tok-questions' })
        expect(result.current.isForeground).toBe(false)
    })

    it('a token refresh re-asks the route; a step that moved on closes the SDK and follows', async () => {
        mockApply.mockResolvedValueOnce(INCOMPLETE).mockResolvedValueOnce({ ...INCOMPLETE, sumsubAccessToken: 'tok-2' })
        const { result } = renderHook(() => useOneShotCardChain())
        await act(() => result.current.start())
        let refreshed = ''
        await act(async () => {
            refreshed = await result.current.refreshToken()
        })
        expect(refreshed).toBe('tok-2')
        expect(result.current.token).toBe('tok-2')

        mockApply.mockResolvedValueOnce(TERMS)
        await act(async () => {
            refreshed = await result.current.refreshToken()
        })
        expect(refreshed).toBe('')
        expect(result.current.chain).toEqual({ kind: 'agreements', isUsResident: false })
    })

    it('reset empties the step for the next flow', async () => {
        mockApply.mockResolvedValue(TERMS)
        const { result } = renderHook(() => useOneShotCardChain())
        await act(() => result.current.start())
        act(() => result.current.reset())
        expect(result.current.chain).toBeNull()
        expect(result.current.isForeground).toBe(false)
    })
})
