/** @jest-environment jsdom */
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

const mockCreate = jest.fn()
const mockRead = jest.fn()
jest.mock('@/services/pix', () => ({
    pixApi: {
        createDeposit: (...args: unknown[]) => mockCreate(...args),
        readDeposit: (id: string) => mockRead(id),
    },
}))

import { ApiError } from '@/services/api-error'
import { DEPOSIT_ACCOUNTS_QUERY_KEY } from '@/features/deposit-accounts/useDepositAccounts'
import { usePixDeposit } from '../usePixDeposit'

// API-CONTRACT.md section 5: the answer for a standing-code route
const STANDING = {
    provider: 'bridge',
    intentId: null,
    status: 'AWAITING_USER_ACTION',
    codePayable: true,
    pixReceived: false,
    brCode: '00020126...standing',
    expiresAt: null,
    amountBrl: null,
    usdcAmount: null,
}

describe('usePixDeposit for a standing code (intentId null)', () => {
    let queryClient: QueryClient
    const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )

    beforeEach(() => {
        jest.clearAllMocks()
        queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    })
    afterEach(() => jest.useRealTimers())

    it('asks for the code with no amount and reads it as payable, with no deposit to follow', async () => {
        mockCreate.mockResolvedValue(STANDING)
        const onComplete = jest.fn()
        const { result } = renderHook(() => usePixDeposit(null, onComplete), { wrapper })

        await waitFor(() => expect(result.current.deposit).toEqual(STANDING))
        expect(mockCreate).toHaveBeenCalledWith()
        expect(mockRead).not.toHaveBeenCalled()
        expect(result.current.phase).toBe('pending')
        expect(result.current.refusal).toBeUndefined()
        expect(onComplete).not.toHaveBeenCalled()
    })

    it('never polls: the code does not change, and each Pix shows in Activity', async () => {
        jest.useFakeTimers()
        mockCreate.mockResolvedValue(STANDING)
        const { result } = renderHook(() => usePixDeposit(null, jest.fn()), { wrapper })
        await waitFor(() => expect(result.current.deposit).toBeDefined())

        await act(() => jest.advanceTimersByTimeAsync(60_000))

        expect(mockCreate).toHaveBeenCalledTimes(1)
    })

    it('has the account lists read again once the first code opened the account', async () => {
        mockCreate.mockResolvedValue(STANDING)
        const invalidate = jest.spyOn(queryClient, 'invalidateQueries')
        renderHook(() => usePixDeposit(null, jest.fn()), { wrapper })

        await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: DEPOSIT_ACCOUNTS_QUERY_KEY }))
    })

    it('asks again while another claim of the account is in flight, then shows the code', async () => {
        jest.useFakeTimers()
        mockCreate
            .mockRejectedValueOnce(new ApiError('in flight', { status: 409, code: 'DEPOSIT_ACCOUNT_CLAIM_IN_FLIGHT' }))
            .mockResolvedValueOnce(STANDING)
        const { result } = renderHook(() => usePixDeposit(null, jest.fn()), { wrapper })

        await act(() => jest.advanceTimersByTimeAsync(2500))

        await waitFor(() => expect(result.current.deposit).toEqual(STANDING))
        expect(mockCreate).toHaveBeenCalledTimes(2)
        expect(result.current.refusal).toBeUndefined()
    })

    it('stops after a few tries and offers one more, which asks again', async () => {
        jest.useFakeTimers()
        mockCreate.mockRejectedValue(
            new ApiError('in flight', { status: 409, code: 'DEPOSIT_ACCOUNT_CLAIM_IN_FLIGHT' })
        )
        const { result } = renderHook(() => usePixDeposit(null, jest.fn()), { wrapper })

        await act(() => jest.advanceTimersByTimeAsync(10_000))
        await waitFor(() => expect(result.current.refusal).toEqual({ screen: 'retry', recheck: false }))
        expect(mockCreate).toHaveBeenCalledTimes(4)

        mockCreate.mockResolvedValue(STANDING)
        act(() => result.current.retry())
        await waitFor(() => expect(result.current.deposit).toEqual(STANDING))
    })

    it('does not ask again for a refusal that a retry cannot change', async () => {
        jest.useFakeTimers()
        mockCreate.mockRejectedValue(new ApiError('refused', { status: 409, code: 'DEPOSIT_ACCOUNT_PROVIDER_REFUSED' }))
        const { result } = renderHook(() => usePixDeposit(null, jest.fn()), { wrapper })

        await waitFor(() =>
            expect(result.current.refusal).toEqual({ screen: 'closed', line: 'depositAccounts.errors.providerRefused' })
        )
        await act(() => jest.advanceTimersByTimeAsync(10_000))
        expect(mockCreate).toHaveBeenCalledTimes(1)
    })
})
