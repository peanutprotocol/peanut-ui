import { renderHook, waitFor } from '@testing-library/react'
import { useCrispTokenId } from '@/hooks/useCrispTokenId'

const mockUseAuth = jest.fn()
jest.mock('@/context/authContext', () => ({
    useAuth: () => mockUseAuth(),
}))

const apiFetchMock = jest.fn()
jest.mock('@/utils/api-fetch', () => ({
    apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}))

const jsonResponse = (body: unknown, ok = true) => ({ ok, json: async () => body }) as unknown as Response

describe('useCrispTokenId', () => {
    beforeEach(() => {
        apiFetchMock.mockReset()
        mockUseAuth.mockReset()
    })

    it('returns undefined and never calls the API when unauthenticated', () => {
        mockUseAuth.mockReturnValue({ userId: undefined })
        const { result } = renderHook(() => useCrispTokenId())
        expect(result.current).toBeUndefined()
        expect(apiFetchMock).not.toHaveBeenCalled()
    })

    it('fetches the token from the authed endpoint for a logged-in user', async () => {
        mockUseAuth.mockReturnValue({ userId: 'user-aaa' })
        apiFetchMock.mockResolvedValue(jsonResponse({ crispTokenId: 'tok-aaa' }))

        const { result } = renderHook(() => useCrispTokenId())

        await waitFor(() => expect(result.current).toBe('tok-aaa'))
    })

    it('takes the userId from the auth token, not a parameter — the call carries no userId', async () => {
        mockUseAuth.mockReturnValue({ userId: 'user-bbb' })
        apiFetchMock.mockResolvedValue(jsonResponse({ crispTokenId: 'tok-bbb' }))

        const { result } = renderHook(() => useCrispTokenId())

        await waitFor(() => expect(result.current).toBe('tok-bbb'))
        // No userId (or any argument) is passed — the server derives it from auth,
        // which is what stops a caller from requesting another user's token.
        expect(apiFetchMock).toHaveBeenCalledWith('/user/crisp-token')
        expect(apiFetchMock.mock.calls[0]).toHaveLength(1)
    })

    it('stays undefined when the endpoint fails (no fallback token)', async () => {
        mockUseAuth.mockReturnValue({ userId: 'user-ccc' })
        apiFetchMock.mockResolvedValue(jsonResponse({}, false))

        const { result } = renderHook(() => useCrispTokenId())

        await waitFor(() => expect(apiFetchMock).toHaveBeenCalled())
        expect(result.current).toBeUndefined()
    })
})
