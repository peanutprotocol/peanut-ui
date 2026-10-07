import { render, screen } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'
import { NuqsTestingAdapter } from 'nuqs/adapters/testing'
import { ContributePotPageWrapper } from '../ContributePotPageWrapper'

const getRequest = jest.fn()
jest.mock('@/services/requests', () => ({ requestsApi: { get: (...args: unknown[]) => getRequest(...args) } }))
jest.mock('@/hooks/useSafeBack', () => ({ useSafeBack: () => jest.fn() }))
jest.mock('@/components/Global/NavHeader', () => ({ __esModule: true, default: () => null }))
jest.mock('../ContributePotPage', () => ({
    ContributePotPage: ({ isCrowdfunding }: { isCrowdfunding: boolean }) => (
        <div data-testid="payment-flow">{isCrowdfunding ? 'Voluntary contribution' : 'Split request'}</div>
    ),
}))

const renderView = () =>
    render(
        <NuqsTestingAdapter searchParams="?id=pot-1&mode=pot">
            <IntlWrapper>
                <ContributePotPageWrapper requestId="pot-1" />
            </IntlWrapper>
        </NuqsTestingAdapter>
    )

it('opens the voluntary contribution flow for an open pot', async () => {
    getRequest.mockResolvedValue({ uuid: 'pot-1', status: 'OPEN' })
    renderView()
    expect(await screen.findByTestId('payment-flow')).toHaveTextContent('Voluntary contribution')
})

it('shows closure instead of payment actions for a closed pot', async () => {
    getRequest.mockResolvedValue({ uuid: 'pot-1', status: 'CLOSED' })
    renderView()
    expect(await screen.findByText('This collection is closed')).toBeInTheDocument()
    expect(screen.queryByTestId('payment-flow')).not.toBeInTheDocument()
})
