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
    it('says the request is paid, with what arrived', async () => {
        getRequest.mockResolvedValue(request({ paidAt: '2026-09-17T10:00:00.000Z', receivedAmount: '250' }))

        renderNotice()

        expect(await screen.findByText('Paid')).toBeInTheDocument()
        expect(screen.getByText('$250 received')).toBeInTheDocument()
    })

    // The backend marks a request paid as soon as a deposit names it, even when
    // less than the asked amount arrived. Reading that as "paid" would tell the
    // requester they were paid in full over a part payment.
    it('says the request is only partly paid when less arrived than was asked', async () => {
        getRequest.mockResolvedValue(request({ paidAt: '2026-09-17T10:00:00.000Z', receivedAmount: '100' }))

        renderNotice()

        expect(await screen.findByText('Partly paid')).toBeInTheDocument()
        expect(screen.getByText('$100 of $250 received')).toBeInTheDocument()
    })

    it('shows nothing while no deposit has answered the request', async () => {
        getRequest.mockResolvedValue(request({}))

        const { container } = renderNotice()

        await waitFor(() => expect(getRequest).toHaveBeenCalled())
        expect(container).toBeEmptyDOMElement()
    })

    it('does not poll a request that shares no bank details', () => {
        render(<RequestFulfillmentNotice requestId="req-1" bankPayable={false} />, { wrapper })

        expect(getRequest).not.toHaveBeenCalled()
    })
})
