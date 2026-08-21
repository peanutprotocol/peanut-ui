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
        apiFetchMock.mockResolvedValue(jsonResponse({ crispTokenId: 'tok-aaa', userId: 'user-aaa' }))

        const { result } = renderHook(() => useCrispTokenId())

        await waitFor(() => expect(result.current).toBe('tok-aaa'))
    })

    it('takes the userId from the auth token, not a parameter — the call carries no userId', async () => {
        mockUseAuth.mockReturnValue({ userId: 'user-bbb' })
        apiFetchMock.mockResolvedValue(jsonResponse({ crispTokenId: 'tok-bbb', userId: 'user-bbb' }))

        const { result } = renderHook(() => useCrispTokenId())

        await waitFor(() => expect(result.current).toBe('tok-bbb'))
        expect(apiFetchMock).toHaveBeenCalledWith('/user/crisp-token')
        expect(apiFetchMock.mock.calls[0]).toHaveLength(1)
    })

    it('discards a token minted for a different user (stale-bearer desync guard)', async () => {
        mockUseAuth.mockReturnValue({ userId: 'user-ccc' })
        // Server derived the token from a bearer that still belongs to someone else.
        apiFetchMock.mockResolvedValue(jsonResponse({ crispTokenId: 'tok-other', userId: 'someone-else' }))

        const { result } = renderHook(() => useCrispTokenId())

        await waitFor(() => expect(apiFetchMock).toHaveBeenCalled())
        expect(result.current).toBeUndefined()
    })

    it('does not keep the previous user’s token after an account switch', async () => {
        mockUseAuth.mockReturnValue({ userId: 'switch-a' })
        apiFetchMock.mockResolvedValue(jsonResponse({ crispTokenId: 'tok-a', userId: 'switch-a' }))

        const { result, rerender } = renderHook(() => useCrispTokenId())
        await waitFor(() => expect(result.current).toBe('tok-a'))

        // Switch to user B: the hook must drop A's token immediately, not serve it
        // while B's token loads.
        mockUseAuth.mockReturnValue({ userId: 'switch-b' })
        apiFetchMock.mockResolvedValue(jsonResponse({ crispTokenId: 'tok-b', userId: 'switch-b' }))
        rerender()

        expect(result.current).not.toBe('tok-a')
        await waitFor(() => expect(result.current).toBe('tok-b'))
    })

    it('retries then stays undefined when the endpoint keeps failing (no fallback token)', async () => {
        mockUseAuth.mockReturnValue({ userId: 'user-ddd' })
        apiFetchMock.mockResolvedValue(jsonResponse({}, false))

        const { result } = renderHook(() => useCrispTokenId())

        await waitFor(() => expect(apiFetchMock.mock.calls.length).toBeGreaterThan(1), { timeout: 3000 })
        expect(result.current).toBeUndefined()
    })
})
