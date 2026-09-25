import React from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const mockGetFees = jest.fn()
const mockGetRails = jest.fn()
jest.mock('@/app/actions/offramp', () => ({
    getUsdPayoutRailFees: () => mockGetFees(),
    getExternalAccountPaymentRails: (customerId: string, accountId: string) => mockGetRails(customerId, accountId),
}))

import { useUsdPayoutSpeeds } from '../useUsdPayoutSpeeds'

const FEES = {
    currency: 'USD',
    minimumAfterFeeUsd: '1.00',
    rails: [
        { rail: 'ach_same_day', feeUsd: '0.00' },
        { rail: 'wire', feeUsd: '20.00' },
    ],
}

const render = (props: Partial<Parameters<typeof useUsdPayoutSpeeds>[0]> = {}) => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    return renderHook(
        () =>
            useUsdPayoutSpeeds({
                enabled: true,
                customerId: 'cust-1',
                externalAccountId: 'ea-1',
                amountUsd: 100,
                ...props,
            }),
        {
            wrapper: ({ children }: { children: React.ReactNode }) => (
                <QueryClientProvider client={client}>{children}</QueryClientProvider>
            ),
        }
    )
}

beforeEach(() => {
    jest.clearAllMocks()
    mockGetFees.mockResolvedValue({ data: FEES })
    mockGetRails.mockResolvedValue({ data: null })
})

describe('useUsdPayoutSpeeds', () => {
    it('is not ready until the fees and the account rails are read, then offers both speeds', async () => {
        const view = render()
        expect(view.result.current.isReady).toBe(false)

        await waitFor(() => expect(view.result.current.isReady).toBe(true))
        expect(view.result.current.options.map((option) => [option.speed, option.feeUsd, option.block])).toEqual([
            ['ach_same_day', '0.00', null],
            ['wire', '20.00', null],
        ])
        expect(mockGetRails).toHaveBeenCalledWith('cust-1', 'ea-1')
    })

    it('blocks a wire the provider says this account cannot take', async () => {
        mockGetRails.mockResolvedValue({ data: { supported: ['ach', 'ach_same_day'] } })
        const view = render()

        await waitFor(() => expect(view.result.current.isReady).toBe(true))
        expect(view.result.current.options[1]).toMatchObject({ speed: 'wire', block: 'accountCannotTake' })
    })

    it('a failed fee read leaves same-day ACH alone, and the withdrawal can go ahead', async () => {
        mockGetFees.mockResolvedValue({ error: 'Not found' })
        const view = render()

        // one retry after a second, then the answer is final
        await waitFor(() => expect(view.result.current.isReady).toBe(true), { timeout: 4000 })
        expect(view.result.current.options.map((option) => option.speed)).toEqual(['ach_same_day'])
    })

    it('reads nothing for a non-USD account', () => {
        const view = render({ enabled: false })

        expect(view.result.current).toEqual({ options: [], isReady: true })
        expect(mockGetFees).not.toHaveBeenCalled()
        expect(mockGetRails).not.toHaveBeenCalled()
    })
})
