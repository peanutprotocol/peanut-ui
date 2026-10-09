import { act, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { IntlWrapper } from '@/test-utils/intl'
import { ChargeFulfillmentNotice } from '../ChargeFulfillmentNotice'

const mockGetCharge = jest.fn()
jest.mock('@/services/charges', () => ({ chargesApi: { get: (...args: unknown[]) => mockGetCharge(...args) } }))

function mount() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
    const view = render(
        <IntlWrapper>
            <QueryClientProvider client={client}>
                <ChargeFulfillmentNotice chargeId="requested-charge" />
            </QueryClientProvider>
        </IntlWrapper>
    )
    return { client, ...view }
}

beforeEach(() => mockGetCharge.mockReset())

test('a targeted request updates to paid without leaving the request screen', async () => {
    mockGetCharge
        .mockResolvedValueOnce({ fulfillmentPayment: null })
        .mockResolvedValue({ fulfillmentPayment: { status: 'SUCCESSFUL' } })
    const { client } = mount()
    await waitFor(() => expect(mockGetCharge).toHaveBeenCalledWith('requested-charge'))
    expect(screen.queryByText('Paid')).not.toBeInTheDocument()
    await act(async () => {
        await client.invalidateQueries({ queryKey: ['request-fulfillment'] })
    })
    expect(await screen.findByText('Payment received')).toBeInTheDocument()
    expect(screen.getByText('Paid')).toBeInTheDocument()
})

test('a pending or failed payment never displays paid', async () => {
    mockGetCharge.mockResolvedValue({ fulfillmentPayment: { status: 'FAILED' } })
    const { container } = mount()
    await waitFor(() => expect(mockGetCharge).toHaveBeenCalled())
    expect(container).toBeEmptyDOMElement()
})
