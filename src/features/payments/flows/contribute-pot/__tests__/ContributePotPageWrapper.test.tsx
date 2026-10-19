/** @jest-environment jsdom */
import { screen } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import { ContributePotPageWrapper } from '../ContributePotPageWrapper'

const mockGet = jest.fn()
jest.mock('@/services/requests', () => ({ requestsApi: { get: (...args: unknown[]) => mockGet(...args) } }))
jest.mock('@/hooks/useSafeBack', () => ({ useSafeBack: () => jest.fn() }))
jest.mock('@/components/Global/NavHeader', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Global/Loading', () => ({ __esModule: true, default: () => null }))
// the payable flow itself is out of scope here: its presence is what is asserted
jest.mock('../ContributePotPage', () => ({ ContributePotPage: () => <div data-testid="pay-flow" /> }))

const request = (fields: Record<string, unknown>) => ({ uuid: 'req-1', tokenAmount: '2', paidAt: null, ...fields })

describe('ContributePotPageWrapper', () => {
    it('renders the pay flow for an open request', async () => {
        mockGet.mockResolvedValue(request({ status: 'OPEN' }))
        renderWithIntl(<ContributePotPageWrapper requestId="req-1" />)
        expect(await screen.findByTestId('pay-flow')).toBeInTheDocument()
    })

    it('blocks payment on a request the requester closed', async () => {
        mockGet.mockResolvedValue(request({ status: 'CLOSED' }))
        renderWithIntl(<ContributePotPageWrapper requestId="req-1" />)
        expect(await screen.findByText('This request is closed')).toBeInTheDocument()
        expect(screen.queryByTestId('pay-flow')).toBeNull()
    })

    it('blocks payment on a closed, paid request', async () => {
        mockGet.mockResolvedValue(request({ status: 'CLOSED', paidAt: '2026-10-19T00:00:00Z' }))
        renderWithIntl(<ContributePotPageWrapper requestId="req-1" />)
        expect(await screen.findByText('This request is closed')).toBeInTheDocument()
        expect(screen.queryByTestId('pay-flow')).toBeNull()
    })
})
