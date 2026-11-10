/** @jest-environment jsdom */
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

const mockDepositStatus = jest.fn()
jest.mock('@/services/pix', () => ({ pixApi: { readDeposit: (id: string) => mockDepositStatus(id) } }))

import { ApiError } from '@/services/api-error'
import { usePixDeposit } from '../usePixDeposit'
import { pixDepositQueryKey } from '../pixDepositCode'

const read = (overrides: Record<string, unknown> = {}) => ({
    provider: 'avenia',
    intentId: 'd1',
    status: 'AWAITING_USER_ACTION',
    pixReceived: false,
    expiresAt: null,
    amountBrl: '100.00',
    usdcAmount: '17.94',
    codePayable: true,
    brCode: 'code',
    payerCpfMasked: '095.***.***-89',
    ...overrides,
})

describe('usePixDeposit', () => {
    let queryClient: QueryClient
    const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )

    beforeEach(() => {
        jest.clearAllMocks()
        queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    })

    it('shows a just-created code from the seeded query, before any read returns', () => {
        mockDepositStatus.mockReturnValue(new Promise(() => {}))
        queryClient.setQueryData(pixDepositQueryKey('d1'), read())
        const { result } = renderHook(() => usePixDeposit('d1', jest.fn()), { wrapper })
        expect(result.current.deposit?.brCode).toBe('code')
        expect(result.current.phase).toBe('pending')
    })

    it('reads nothing right after the create: the seeded code is fresh until the next poll', async () => {
        mockDepositStatus.mockResolvedValue(read())
        queryClient.setQueryData(pixDepositQueryKey('d1'), read())
        renderHook(() => usePixDeposit('d1', jest.fn()), { wrapper })
        await new Promise((resolve) => setTimeout(resolve, 50))
        expect(mockDepositStatus).not.toHaveBeenCalled()
    })

    it('reads the code from the API when nothing is seeded (a reload, a deep link)', async () => {
        mockDepositStatus.mockResolvedValue(read())
        const { result } = renderHook(() => usePixDeposit('d1', jest.fn()), { wrapper })
        await waitFor(() => expect(result.current.deposit?.brCode).toBe('code'))
        expect(mockDepositStatus).toHaveBeenCalledWith('d1')
    })

    it('fires onComplete once when the deposit completes', async () => {
        mockDepositStatus.mockResolvedValue(read({ status: 'COMPLETED', pixReceived: true, codePayable: false }))
        const onComplete = jest.fn()
        const { result, rerender } = renderHook(() => usePixDeposit('d1', onComplete), { wrapper })

        await waitFor(() => expect(result.current.phase).toBe('completed'))
        rerender()
        expect(onComplete).toHaveBeenCalledTimes(1)
    })

    // the screen stays mounted while the URL moves to the next deposit: that one is reported too
    it('fires onComplete again for another deposit that completes on the same screen', async () => {
        mockDepositStatus.mockImplementation(async (id: string) =>
            read({ intentId: id, status: 'COMPLETED', pixReceived: true, codePayable: false })
        )
        const onComplete = jest.fn()
        const { result, rerender } = renderHook(({ id }) => usePixDeposit(id, onComplete), {
            wrapper,
            initialProps: { id: 'd1' },
        })
        await waitFor(() => expect(result.current.phase).toBe('completed'))

        rerender({ id: 'd2' })
        await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(2))
        rerender({ id: 'd2' })
        expect(onComplete).toHaveBeenCalledTimes(2)
    })

    it('reads a code that is no longer payable as expired', async () => {
        mockDepositStatus.mockResolvedValue(read({ codePayable: false, brCode: undefined }))
        const { result } = renderHook(() => usePixDeposit('d1', jest.fn()), { wrapper })
        await waitFor(() => expect(result.current.phase).toBe('expired'))
    })

    describe('when the read fails', () => {
        beforeEach(() => jest.useFakeTimers())
        afterEach(() => jest.useRealTimers())

        it.each([
            [404, 1],
            [500, 2],
        ])('polls on after a %s only when waiting can change it', async (status, reads) => {
            mockDepositStatus.mockRejectedValue(new ApiError('read failed', { status }))
            const { result } = renderHook(() => usePixDeposit('d1', jest.fn()), { wrapper })
            await waitFor(() => expect(result.current.isError).toBe(true))

            await jest.advanceTimersByTimeAsync(6000)

            expect(mockDepositStatus).toHaveBeenCalledTimes(reads)
        })
    })
})
