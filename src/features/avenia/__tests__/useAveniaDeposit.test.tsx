/** @jest-environment jsdom */
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

const mockDepositStatus = jest.fn()
jest.mock('@/services/avenia', () => ({ aveniaApi: { depositStatus: (id: string) => mockDepositStatus(id) } }))

import { useAveniaDeposit } from '../hooks/useAveniaDeposit'
import { aveniaDepositQueryKey, depositReadFromCreated } from '../aveniaDepositCode'

const read = (overrides: Record<string, unknown> = {}) => ({
    intentId: 'd1',
    status: 'AWAITING_USER_ACTION',
    ticketStatus: 'UNPAID',
    expiresAt: null,
    amountBrl: '100.00',
    usdcAmount: '17.94',
    codePayable: true,
    brCode: 'code',
    payerCpfMasked: '095.***.***-89',
    ...overrides,
})

describe('useAveniaDeposit', () => {
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
        queryClient.setQueryData(
            aveniaDepositQueryKey('d1'),
            depositReadFromCreated({
                intentId: 'd1',
                brCode: 'code',
                amountBrl: '100.00',
                usdcAmount: '17.94',
                fixedFeeBrl: '0.75',
                expiresAt: null,
                payerCpfMasked: '095.***.***-89',
            })
        )
        const { result } = renderHook(() => useAveniaDeposit('d1', jest.fn()), { wrapper })
        expect(result.current.deposit?.brCode).toBe('code')
        expect(result.current.phase).toBe('pending')
    })

    it('reads the code from the API when nothing is seeded (a reload, a deep link)', async () => {
        mockDepositStatus.mockResolvedValue(read())
        const { result } = renderHook(() => useAveniaDeposit('d1', jest.fn()), { wrapper })
        await waitFor(() => expect(result.current.deposit?.brCode).toBe('code'))
        expect(mockDepositStatus).toHaveBeenCalledWith('d1')
    })

    it('fires onComplete once when the deposit completes', async () => {
        mockDepositStatus.mockResolvedValue(read({ status: 'COMPLETED', ticketStatus: 'PAID', codePayable: false }))
        const onComplete = jest.fn()
        const { result, rerender } = renderHook(() => useAveniaDeposit('d1', onComplete), { wrapper })

        await waitFor(() => expect(result.current.phase).toBe('completed'))
        rerender()
        expect(onComplete).toHaveBeenCalledTimes(1)
    })

    it('reads a code that is no longer payable as expired', async () => {
        mockDepositStatus.mockResolvedValue(read({ codePayable: false, brCode: undefined }))
        const { result } = renderHook(() => useAveniaDeposit('d1', jest.fn()), { wrapper })
        await waitFor(() => expect(result.current.phase).toBe('expired'))
    })
})
