/**
 * The peso deposit success switch (HANDOFF rule 7): the details screen turns
 * into the success screen when the order completes while the user watches it,
 * exactly once, and never for an order that was complete before the screen
 * opened. Runs the flow's own pairing: the Manteca status poll feeding
 * useDepositSuccessEntry, with real react-query and the API calls stubbed.
 */
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

const mockGetDepositStatus = jest.fn()
jest.mock('@/services/manteca', () => ({
    mantecaApi: { getDepositStatus: (...args: unknown[]) => mockGetDepositStatus(...args) },
}))
const mockApiFetch = jest.fn()
jest.mock('@/utils/api-fetch', () => ({ apiFetch: (...args: unknown[]) => mockApiFetch(...args) }))

// imported after the jest.mock calls above
import { useMantecaDepositPolling } from '@/components/AddMoney/hooks/useMantecaDepositPolling'
import { useDepositSuccessEntry } from '../useDepositSuccessEntry'
import { TRANSACTIONS } from '@/constants/query.consts'

const entry = {
    uuid: 'dep-1',
    type: 'MANTECA_ONRAMP',
    status: 'COMPLETED',
    amount: '10',
    currency: { amount: '10000', code: 'ARS' },
    chainId: '42161',
    tokenSymbol: 'USDC',
    tokenAddress: '0x',
    userRole: 'RECIPIENT',
    timestamp: '2026-11-27T10:00:00Z',
    extraData: { kind: 'ONRAMP', provider: 'MANTECA' },
}

const statusOf = (status: string, stage = 1) => ({ data: { id: 'dep-1', status, stage } })

let queryClient: QueryClient
const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
)

function renderPesoScreen(depositId = 'dep-1') {
    return renderHook(
        ({ id }: { id: string }) => {
            const { watchPhase } = useMantecaDepositPolling(id, () => undefined)
            return useDepositSuccessEntry(id, watchPhase)
        },
        { wrapper, initialProps: { id: depositId } }
    )
}

// the poll runs every 5 s; refetch by hand instead of waiting for it
const nextPoll = () => act(() => queryClient.refetchQueries({ queryKey: ['manteca-deposit-status'] }))

beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    mockGetDepositStatus.mockReset()
    mockApiFetch.mockReset()
    mockApiFetch.mockResolvedValue({ ok: true, json: async () => entry })
})

it('switches to success when the order completes while the screen is up', async () => {
    mockGetDepositStatus.mockResolvedValue(statusOf('PENDING'))
    const { result } = renderPesoScreen()
    await waitFor(() => expect(mockGetDepositStatus).toHaveBeenCalledTimes(1))
    expect(result.current).toBeNull()

    mockGetDepositStatus.mockResolvedValue(statusOf('COMPLETED', 3))
    await nextPoll()

    await waitFor(() => expect(result.current?.uuid).toBe('dep-1'))
    // the entry is read by the deposit's synthetic id, as the ONRAMP receipt
    expect(mockApiFetch).toHaveBeenCalledWith('/history/dep-1?kind=ONRAMP')
})

it('keeps the success screen across re-renders once shown', async () => {
    mockGetDepositStatus.mockResolvedValue(statusOf('PENDING'))
    const { result, rerender } = renderPesoScreen()
    await waitFor(() => expect(mockGetDepositStatus).toHaveBeenCalledTimes(1))
    mockGetDepositStatus.mockResolvedValue(statusOf('COMPLETED', 3))
    await nextPoll()
    await waitFor(() => expect(result.current).not.toBeNull())

    rerender({ id: 'dep-1' })
    await nextPoll()
    expect(result.current?.uuid).toBe('dep-1')
})

it('does not show success for an order that was already complete when the screen opened', async () => {
    mockGetDepositStatus.mockResolvedValue(statusOf('COMPLETED', 3))
    const { result, rerender } = renderPesoScreen()
    await waitFor(() => expect(mockGetDepositStatus).toHaveBeenCalledTimes(1))

    // the entry loads, and still no success: the screen never saw the order open
    await waitFor(() => expect(queryClient.getQueryData([TRANSACTIONS, 'entry', 'dep-1', 'ONRAMP'])).toBeDefined())
    await nextPoll()
    rerender({ id: 'dep-1' })
    expect(result.current).toBeNull()
})

it('does not show success for an order that expired unpaid', async () => {
    mockGetDepositStatus.mockResolvedValue(statusOf('PENDING'))
    const { result } = renderPesoScreen()
    await waitFor(() => expect(mockGetDepositStatus).toHaveBeenCalledTimes(1))

    mockGetDepositStatus.mockResolvedValue({ data: { id: 'dep-1', status: 'CANCELLED', stage: 1, expired: true } })
    await nextPoll()
    await waitFor(() => expect(mockGetDepositStatus).toHaveBeenCalledTimes(2))
    expect(result.current).toBeNull()
    expect(mockApiFetch).not.toHaveBeenCalled()
})
