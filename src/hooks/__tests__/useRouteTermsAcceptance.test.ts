/** @jest-environment jsdom */
import { act, renderHook } from '@testing-library/react'
import { ApiError } from '@/services/api-error'

jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
const mockFetchUser = jest.fn(() => Promise.resolve(null))
jest.mock('@/context/authContext', () => ({ useAuth: () => ({ fetchUser: mockFetchUser }) }))
const mockMarkSubmitted = jest.fn()
jest.mock('@/hooks/useSubmissionWindow', () => ({ markSubmitted: () => mockMarkSubmitted() }))
const mockAccept = jest.fn()
jest.mock('@/services/consent', () => ({ consentApi: { acceptRouteTerms: (key: string) => mockAccept(key) } }))
const mockCapture = jest.fn()
jest.mock('@/utils/sentry-lazy', () => ({ captureException: (...args: unknown[]) => mockCapture(...args) }))

import { useRouteTermsAcceptance } from '../useRouteTermsAcceptance'

describe('useRouteTermsAcceptance', () => {
    beforeEach(() => jest.clearAllMocks())

    it("records the route's terms step, then reads the capabilities again and follows the wait", async () => {
        mockAccept.mockResolvedValue(undefined)
        const { result } = renderHook(() => useRouteTermsAcceptance('accept-tos:avenia'))

        await act(async () => {
            await result.current.accept()
        })

        expect(mockAccept).toHaveBeenCalledWith('accept-tos:avenia')
        expect(mockMarkSubmitted).toHaveBeenCalled()
        expect(mockFetchUser).toHaveBeenCalled()
        expect(result.current.error).toBeNull()
    })

    it('reads the capabilities again, with no error, when the route no longer names the step (409)', async () => {
        mockAccept.mockRejectedValue(new ApiError('moved', { status: 409, code: 'ROUTE_NOT_AVAILABLE' }))
        const { result } = renderHook(() => useRouteTermsAcceptance('accept-tos:avenia'))

        await act(async () => {
            await result.current.accept()
        })

        expect(mockFetchUser).toHaveBeenCalled()
        expect(result.current.error).toBeNull()
        expect(mockCapture).not.toHaveBeenCalled()
    })

    it('says the acceptance was not saved when the API could not store it (500)', async () => {
        mockAccept.mockRejectedValue(new ApiError('not saved', { status: 500 }))
        const { result } = renderHook(() => useRouteTermsAcceptance('accept-tos:avenia'))

        await act(async () => {
            await result.current.accept()
        })

        expect(result.current.error).toBe('setup.termsNotSaved')
        expect(mockMarkSubmitted).not.toHaveBeenCalled()
    })

    it('reports any other failure with the critical-flow tags', async () => {
        mockAccept.mockRejectedValue(new TypeError('Failed to fetch'))
        const { result } = renderHook(() => useRouteTermsAcceptance('accept-tos:avenia'))

        await act(async () => {
            await result.current.accept()
        })

        expect(result.current.error).toBe('unavailable')
        expect(mockCapture).toHaveBeenCalledWith(expect.any(TypeError), {
            tags: { critical_flow: 'kyc', kyc_step: 'route_terms' },
        })
    })

    it('does nothing without a terms step', async () => {
        const { result } = renderHook(() => useRouteTermsAcceptance(undefined))
        await act(async () => {
            await result.current.accept()
        })
        expect(mockAccept).not.toHaveBeenCalled()
    })
})
