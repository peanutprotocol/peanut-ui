import React, { type ReactNode } from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { IntlWrapper } from '@/test-utils/intl'
import type { TRequestResponse } from '@/services/services.types'

// TASK-23856: the payer page read the request once and refetched only the
// remainder. After Hugo paid $40.65 of $99.16 the screen knew "$58.51 left"
// but not Hugo, so it suggested the whole $58.51. Both now refetch together.

const mockGet = jest.fn()
const mockPayAmounts = jest.fn()
jest.mock('@/services/requests', () => ({
    requestsApi: {
        get: (...args: unknown[]) => mockGet(...args),
        payAmounts: (...args: unknown[]) => mockPayAmounts(...args),
    },
}))
jest.mock('@/features/payments/shared/hooks/useChargeManager', () => ({
    useChargeManager: () => ({ createCharge: jest.fn() }),
}))
jest.mock('@/features/payments/shared/hooks/usePaymentRecorder', () => ({
    usePaymentRecorder: () => ({ recordPayment: jest.fn() }),
}))
jest.mock('@/hooks/wallet/useWallet', () => ({
    useWallet: () => ({ address: undefined, sendMoney: jest.fn(), hasSufficientSpendableBalance: () => true }),
}))
jest.mock('@/context/authContext', () => ({ useAuth: () => ({ user: null }) }))
jest.mock('@/hooks/useFriendlyError', () => ({ useFriendlyError: () => String }))

import { ContributePotFlowProvider } from '../ContributePotFlowContext'
import { useContributePotFlow } from '../useContributePotFlow'

const hugoCharge = {
    uuid: 'charge-hugo',
    createdAt: '2026-10-19T19:34:13Z',
    tokenAmount: '40.65',
    tokenDecimals: 6,
    settledAmount: '40.65',
    payments: [],
    fulfillmentPayment: { status: 'SUCCESSFUL', payerAddress: '0xhugo', payerAccount: { user: { username: 'hugo' } } },
}

const request = (charges: unknown[], totalCollectedAmount: number) =>
    ({
        uuid: 'request-1',
        tokenAmount: '99.16',
        recipientAddress: '0x1111111111111111111111111111111111111111',
        recipientAccount: { userId: 'requester', identifier: '0x1', type: 'peanut-wallet', user: { username: 'ana' } },
        charges,
        totalCollectedAmount,
    }) as unknown as TRequestResponse

const left = (amount: string) => ({
    requestCurrency: 'USD',
    requestAmount: '99.16',
    remainingAmount: amount,
    rails: [{ kind: 'peanut_balance', payerAmount: { amount, currency: 'USD' } }],
})

const renderFlow = () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const wrapper = ({ children }: { children: ReactNode }) => (
        <IntlWrapper>
            <QueryClientProvider client={client}>
                <ContributePotFlowProvider initialRequest={request([], 0)}>{children}</ContributePotFlowProvider>
            </QueryClientProvider>
        </IntlWrapper>
    )
    return renderHook(() => useContributePotFlow(), { wrapper })
}

beforeEach(() => {
    jest.clearAllMocks()
    mockPayAmounts.mockResolvedValue(left('99.16'))
})

test('a refetch reads the new contributor together with the new remainder', async () => {
    const { result } = renderFlow()
    await waitFor(() => expect(result.current.remainingAmount).toBeCloseTo(99.16, 2))
    expect(result.current.sliderDefaults.suggestedAmount).toBeCloseTo(99.16, 2)

    // Hugo pays $40.65 meanwhile
    mockGet.mockResolvedValue(request([hugoCharge], 40.65))
    mockPayAmounts.mockResolvedValue(left('58.51'))
    await act(async () => {
        await result.current.refetchRequestPot()
    })

    // react-query hands the new data to React on its next tick
    await waitFor(() => expect(result.current.remainingAmount).toBeCloseTo(58.51, 2))
    expect(result.current.contributors.map((c) => c.amount)).toEqual(['40.65'])
    // the median contribution, not the whole remainder
    expect(result.current.sliderDefaults.suggestedAmount).toBeCloseTo(40.65, 2)
})

test('coming back to the amount screen reads the request again', async () => {
    const { result } = renderFlow()
    await waitFor(() => expect(mockPayAmounts).toHaveBeenCalledTimes(1))
    // the page wrapper's read is the starting data: no second read on load
    expect(mockGet).not.toHaveBeenCalled()

    mockGet.mockResolvedValue(request([hugoCharge], 40.65))
    act(() => result.current.setCurrentView('EXTERNAL_WALLET'))
    act(() => result.current.setCurrentView('INITIAL'))

    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(result.current.contributors).toHaveLength(1))
    expect(mockPayAmounts).toHaveBeenCalledTimes(2)
})
