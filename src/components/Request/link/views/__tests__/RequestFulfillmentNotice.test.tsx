import { IntlWrapper } from '@/test-utils/intl'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
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

const wrapper = ({ children }: { children: ReactNode }) => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    return (
        <IntlWrapper>
            <QueryClientProvider client={client}>{children}</QueryClientProvider>
        </IntlWrapper>
    )
}

const renderNotice = () => render(<RequestFulfillmentNotice requestId="req-1" bankPayable={true} />, { wrapper })

beforeEach(() => jest.clearAllMocks())

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

    it('names the payer once the request is paid', async () => {
        getRequest.mockResolvedValue(request({ bankFulfilment: 'paid', receivedAmount: '250', payerName: 'ANA SILVA' }))

        renderNotice()

        expect(await screen.findByText('Paid')).toBeInTheDocument()
        expect(screen.getByText('Paid by ANA SILVA')).toBeInTheDocument()
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
                paidAt: '2026-09-20T22:00:00.000Z',
            })
        )

        renderNotice()

        expect(await screen.findByText('Paid')).toBeInTheDocument()
        expect(screen.queryByText('Partly paid')).not.toBeInTheDocument()
        expect(screen.getByText('$40 of $250 by bank transfer. The rest was paid another way.')).toBeInTheDocument()
    })

    // The row reports the bank transfer. A request answered entirely inside
    // Peanut has no bank transfer to report, so it shows no row at all.
    it('shows nothing when the whole request was paid from a balance', async () => {
        getRequest.mockResolvedValue(request({ bankFulfilment: 'none', paidAt: '2026-09-20T22:00:00.000Z' }))

        const { container } = renderNotice()

        await waitFor(() => expect(getRequest).toHaveBeenCalled())
        expect(container).toBeEmptyDOMElement()
    })

    it('does not poll a request that shares no bank details', () => {
        render(<RequestFulfillmentNotice requestId="req-1" bankPayable={false} />, { wrapper })

        expect(getRequest).not.toHaveBeenCalled()
    })
})
