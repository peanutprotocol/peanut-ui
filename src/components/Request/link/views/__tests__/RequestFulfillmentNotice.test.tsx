import { IntlWrapper } from '@/test-utils/intl'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { RequestFulfillmentNotice } from '../RequestFulfillmentNotice'

const getRequest = jest.fn()
jest.mock('@/services/requests', () => ({
    requestsApi: { get: (...args: unknown[]) => getRequest(...args) },
}))

const request = (over: Record<string, unknown>) => ({
    uuid: 'req-1',
    tokenAmount: '250',
    paidAt: null,
    receivedAmount: null,
    bankFulfilment: 'none',
    payerName: null,
    ...over,
})

let client: QueryClient
const wrapper = ({ children }: { children: ReactNode }) => {
    return (
        <IntlWrapper>
            <QueryClientProvider client={client}>{children}</QueryClientProvider>
        </IntlWrapper>
    )
}

const renderNotice = () => render(<RequestFulfillmentNotice requestId="req-1" bankPayable={true} />, { wrapper })

beforeEach(() => {
    jest.clearAllMocks()
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
})

describe('RequestFulfillmentNotice', () => {
    it('shows nothing while no deposit has answered the request', async () => {
        getRequest.mockResolvedValue(request({}))

        const { container } = renderNotice()

        await waitFor(() => expect(getRequest).toHaveBeenCalled())
        expect(container).toBeEmptyDOMElement()
    })

    // A part payment leaves the requester with something to do, so it states
    // both numbers: what arrived and what was asked for.
    it('states both amounts while the request is only partly paid', async () => {
        getRequest.mockResolvedValue(request({ bankFulfilment: 'partial', receivedAmount: '100' }))

        renderNotice()

        expect(await screen.findByText('Partly paid')).toBeInTheDocument()
        expect(screen.getByText('$100 of $250 received')).toBeInTheDocument()
    })

    it('includes bank and balance payments in progress while the request is still open', async () => {
        getRequest.mockResolvedValue(
            request({ bankFulfilment: 'partial', receivedAmount: '100', totalCollectedAmount: 50 })
        )

        renderNotice()

        expect(await screen.findByText('$150 of $250 received')).toBeInTheDocument()
        expect(screen.getByText('Payment')).toBeInTheDocument()
        expect(screen.getByText('Partly paid')).toBeInTheDocument()
        expect(screen.queryByText('$100 of $250 received')).not.toBeInTheDocument()
    })

    it('updates mixed-payment progress when another balance payment arrives', async () => {
        const invalidate = jest.spyOn(client, 'invalidateQueries')
        getRequest
            .mockResolvedValueOnce(
                request({ bankFulfilment: 'partial', receivedAmount: '100', totalCollectedAmount: 50 })
            )
            .mockResolvedValue(request({ bankFulfilment: 'partial', receivedAmount: '100', totalCollectedAmount: 75 }))

        renderNotice()
        expect(await screen.findByText('$150 of $250 received')).toBeInTheDocument()
        invalidate.mockClear()

        await act(async () => {
            await client.invalidateQueries({ queryKey: ['request-fulfillment'] })
        })

        expect(await screen.findByText('$175 of $250 received')).toBeInTheDocument()
        expect(screen.getByText('Partly paid')).toBeInTheDocument()
        await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ['transactions'] }))
    })

    it.each([
        ['100.00', 100.21, '200.21'],
        ['10.00', 6.15, '16.15'],
        ['100.009', 100.001, '200.01'],
        ['100.004', 100.004, '200'],
    ])(
        'preserves cents when combining bank %s and balance %s payments',
        async (receivedAmount, totalCollectedAmount, total) => {
            getRequest.mockResolvedValue(
                request({ tokenAmount: '500', bankFulfilment: 'partial', receivedAmount, totalCollectedAmount })
            )

            renderNotice()

            expect(await screen.findByText(`$${total} of $500 received`)).toBeInTheDocument()
            expect(screen.getByText('Partly paid')).toBeInTheDocument()
        }
    )

    it('names the payer once the request is paid', async () => {
        getRequest.mockResolvedValue(request({ bankFulfilment: 'paid', receivedAmount: '250', payerName: 'ANA SILVA' }))

        renderNotice()

        expect(await screen.findByText('Paid')).toBeInTheDocument()
        expect(screen.getByText('Paid by ANA SILVA')).toBeInTheDocument()
    })

    it('refreshes activity when polling first observes a bank payment', async () => {
        const invalidate = jest.spyOn(client, 'invalidateQueries')
        getRequest.mockResolvedValue(request({ bankFulfilment: 'paid', receivedAmount: '250' }))

        renderNotice()

        await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ['transactions'] }))
    })

    it('refreshes activity for each larger partial bank payment, but not an identical poll', async () => {
        const invalidate = jest.spyOn(client, 'invalidateQueries')
        getRequest
            .mockResolvedValueOnce(request({ bankFulfilment: 'partial', receivedAmount: '100' }))
            .mockResolvedValue(request({ bankFulfilment: 'partial', receivedAmount: '150' }))

        renderNotice()

        const transactionRefreshes = () =>
            invalidate.mock.calls.filter(([filters]) => filters?.queryKey?.[0] === 'transactions').length
        await waitFor(() => expect(transactionRefreshes()).toBe(1))

        await client.refetchQueries({ queryKey: ['request-fulfillment', 'req-1'] })
        await waitFor(() => expect(transactionRefreshes()).toBe(2))

        await client.refetchQueries({ queryKey: ['request-fulfillment', 'req-1'] })
        expect(transactionRefreshes()).toBe(2)
    })

    it('refreshes activity when a partial bank payment completes the request', async () => {
        const invalidate = jest.spyOn(client, 'invalidateQueries')
        getRequest
            .mockResolvedValueOnce(request({ bankFulfilment: 'partial', receivedAmount: '100' }))
            .mockResolvedValue(request({ bankFulfilment: 'paid', receivedAmount: '250' }))

        renderNotice()

        const transactionRefreshes = () =>
            invalidate.mock.calls.filter(([filters]) => filters?.queryKey?.[0] === 'transactions').length
        await waitFor(() => expect(transactionRefreshes()).toBe(1))

        await client.refetchQueries({ queryKey: ['request-fulfillment', 'req-1'] })
        await waitFor(() => expect(transactionRefreshes()).toBe(2))
    })

    it('refreshes the same bank amount when the component moves to another request', async () => {
        const invalidate = jest.spyOn(client, 'invalidateQueries')
        getRequest.mockResolvedValue(request({ bankFulfilment: 'partial', receivedAmount: '100' }))

        const { rerender } = renderNotice()

        const transactionRefreshes = () =>
            invalidate.mock.calls.filter(([filters]) => filters?.queryKey?.[0] === 'transactions').length
        await waitFor(() => expect(transactionRefreshes()).toBe(1))

        rerender(<RequestFulfillmentNotice requestId="req-2" bankPayable={true} />)
        await waitFor(() => expect(getRequest).toHaveBeenCalledWith('req-2'))
        await waitFor(() => expect(transactionRefreshes()).toBe(2))
    })

    // The bank does not always report a name. The request is still paid, and
    // saying so without one beats an empty row.
    it('says the bank paid it when no name came with the transfer', async () => {
        getRequest.mockResolvedValue(request({ bankFulfilment: 'paid', receivedAmount: '250' }))

        renderNotice()

        expect(await screen.findByText('Paid')).toBeInTheDocument()
        expect(screen.getByText('Paid by bank transfer')).toBeInTheDocument()
    })

    // The field ships with the backend that fills it; until then the amounts
    // still have to answer the question.
    it('falls back to the amounts on a response with no verdict', async () => {
        getRequest.mockResolvedValue({
            uuid: 'req-1',
            tokenAmount: '250',
            paidAt: '2026-09-17T10:00:00.000Z',
            receivedAmount: '100',
        })

        renderNotice()

        expect(await screen.findByText('Partly paid')).toBeInTheDocument()
    })

    /**
     * QA round 2, Q5. $40 by bank transfer, $60 from a Peanut balance, request
     * closed. `bankFulfilment` says `partial` — true about the bank book, and a
     * lie as a badge: it asked the requester to chase money nobody owed.
     */
    it('a request settled by bank AND balance is paid, and says where the bank part sits', async () => {
        getRequest.mockResolvedValue(
            request({
                bankFulfilment: 'partial',
                receivedAmount: '40',
                totalCollectedAmount: 210,
                paidAt: '2026-09-20T22:00:00.000Z',
            })
        )

        renderNotice()

        expect(await screen.findByText('Paid')).toBeInTheDocument()
        expect(screen.queryByText('Partly paid')).not.toBeInTheDocument()
        expect(screen.getByText('$40 of $250 by bank transfer. The rest was paid another way.')).toBeInTheDocument()
    })

    it('shows paid when the whole request was paid from a balance', async () => {
        getRequest.mockResolvedValue(request({ bankFulfilment: 'none', paidAt: '2026-09-20T22:00:00.000Z' }))

        renderNotice()
        expect(await screen.findByText('Payment received')).toBeInTheDocument()
        expect(screen.getByText('Paid')).toBeInTheDocument()
    })

    it('also watches a request that shares no bank details', async () => {
        render(<RequestFulfillmentNotice requestId="req-1" bankPayable={false} />, { wrapper })

        await waitFor(() => expect(getRequest).toHaveBeenCalledWith('req-1'))
    })
})

it('refreshes the visible notice on a socket invalidation without leaving the screen', async () => {
    getRequest.mockResolvedValueOnce(request({})).mockResolvedValue(request({ totalCollectedAmount: 250 }))
    renderNotice()
    await waitFor(() => expect(getRequest).toHaveBeenCalledTimes(1))
    await act(async () => {
        await client.invalidateQueries({ queryKey: ['request-fulfillment'] })
    })
    expect(await screen.findByText('Payment received')).toBeInTheDocument()
    expect(screen.getByText('Paid')).toBeInTheDocument()
})

it('recovers a missed push on the visible screen with a five-second poll', async () => {
    jest.useFakeTimers()
    try {
        getRequest.mockResolvedValueOnce(request({})).mockResolvedValue(request({ totalCollectedAmount: 100 }))
        renderNotice()
        await act(async () => {
            await jest.advanceTimersByTimeAsync(0)
        })
        expect(getRequest).toHaveBeenCalledTimes(1)
        await act(async () => {
            await jest.advanceTimersByTimeAsync(5000)
        })
        expect(getRequest).toHaveBeenCalledTimes(2)
        await act(async () => {
            await jest.advanceTimersByTimeAsync(1)
        })
        expect(screen.getByText('Partly paid')).toBeInTheDocument()
        expect(screen.getByText('$100 of $250 received')).toBeInTheDocument()
    } finally {
        jest.useRealTimers()
    }
})
