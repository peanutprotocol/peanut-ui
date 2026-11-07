/** @jest-environment jsdom */
import { act, renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { ApiError } from '@/services/api-error'

jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
const mockSetRecoveryKey = jest.fn()
jest.mock('@/services/avenia', () => ({
    aveniaApi: { setRecoveryKey: (intentId: string, pixKey: string) => mockSetRecoveryKey(intentId, pixKey) },
}))

import { useAveniaRecoveryKey } from '../hooks/useAveniaRecoveryKey'

const KEY = '09579927189'

describe('useAveniaRecoveryKey', () => {
    let queryClient: QueryClient
    const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )

    beforeEach(() => {
        jest.clearAllMocks()
        queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    })

    it('sends the key once for the withdrawal and reads its history entry again', async () => {
        mockSetRecoveryKey.mockResolvedValue({ accepted: true })
        const invalidate = jest.spyOn(queryClient, 'invalidateQueries')
        const { result } = renderHook(() => useAveniaRecoveryKey('w1'), { wrapper })

        await act(async () => {
            // a second tap before the answer sends nothing more
            await Promise.all([result.current.submit(KEY), result.current.submit(KEY)])
        })

        expect(mockSetRecoveryKey).toHaveBeenCalledTimes(1)
        expect(mockSetRecoveryKey).toHaveBeenCalledWith('w1', KEY)
        expect(result.current.phase).toBe('accepted')
        expect(result.current.refusal).toBeNull()
        expect(invalidate).toHaveBeenCalled()
    })

    it('reads a 409 as a withdrawal that no longer waits for a key', async () => {
        mockSetRecoveryKey.mockRejectedValue(
            new ApiError('This withdrawal is not waiting for a new key', { status: 409 })
        )
        const invalidate = jest.spyOn(queryClient, 'invalidateQueries')
        const { result } = renderHook(() => useAveniaRecoveryKey('w1'), { wrapper })

        await act(async () => {
            await result.current.submit(KEY)
        })

        expect(result.current.phase).toBe('not-waiting')
        expect(result.current.refusal).toBeNull()
        // its receipt shows the state it moved to
        expect(invalidate).toHaveBeenCalled()

        await act(async () => {
            await result.current.submit(KEY)
        })
        expect(mockSetRecoveryKey).toHaveBeenCalledTimes(1)
    })

    it('puts a refusal of the key itself under the field, anything else above Continue', async () => {
        mockSetRecoveryKey.mockRejectedValueOnce(new ApiError('own', { status: 422, code: 'PIX_KEY_NOT_OWN' }))
        const { result } = renderHook(() => useAveniaRecoveryKey('w1'), { wrapper })

        await act(async () => {
            await result.current.submit(KEY)
        })
        expect(result.current.phase).toBe('idle')
        expect(result.current.refusal).toEqual({ message: 'withdraw.keyNotOwn', key: KEY })

        mockSetRecoveryKey.mockRejectedValueOnce(new ApiError('down', { status: 502, code: 'PROVIDER_UNAVAILABLE' }))
        await act(async () => {
            await result.current.submit(KEY)
        })
        expect(result.current.refusal).toEqual({ message: 'unavailable', key: null })
    })
})
