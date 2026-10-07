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
        <NuqsTestingAdapter searchParams="?id=pot-1">
            <IntlWrapper>
                <ContributePotPageWrapper requestId="pot-1" />
            </IntlWrapper>
        </NuqsTestingAdapter>
    )

it('opens the voluntary contribution flow for an open pot', async () => {
    getRequest.mockResolvedValue({ uuid: 'pot-1', status: 'OPEN', isCrowdfunding: true })
    renderView()
    expect(await screen.findByTestId('payment-flow')).toHaveTextContent('Voluntary contribution')
})

it('shows closure instead of payment actions for a closed pot', async () => {
    getRequest.mockResolvedValue({ uuid: 'pot-1', status: 'CLOSED', isCrowdfunding: true })
    renderView()
    expect(await screen.findByText('This collection is closed')).toBeInTheDocument()
    expect(screen.queryByTestId('payment-flow')).not.toBeInTheDocument()
})

it('keeps ordinary requests in the split flow', async () => {
    getRequest.mockResolvedValue({ uuid: 'pot-1', status: 'OPEN', isCrowdfunding: false })
    renderView()
    expect(await screen.findByTestId('payment-flow')).toHaveTextContent('Split request')
})
