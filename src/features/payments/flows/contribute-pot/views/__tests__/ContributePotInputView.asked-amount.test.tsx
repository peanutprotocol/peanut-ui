/**
 * A request asked in another currency leads the pay screen with what it asks
 * for. The card and the amount field are in dollars, and the asked amount used
 * to show only in a grey note under the payment methods.
 */
import { render, screen } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'

jest.mock('@/hooks/useSafeBack', () => ({ useSafeBack: () => jest.fn() }))
jest.mock('@/context/authContext', () => ({ useAuth: () => ({ isFetchingUser: false }) }))
jest.mock('@/components/Global/NavHeader', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Global/AmountInput', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/User/UserCard', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Global/SupportCTA', () => ({ __esModule: true, default: () => null }))
jest.mock('../../components/RequestPotActionList', () => ({ RequestPotActionList: () => null }))

let mockRequest: Record<string, unknown>
jest.mock('../../useContributePotFlow', () => ({
    useContributePotFlow: () => ({
        amount: '',
        request: mockRequest,
        recipient: { username: 'ana', userId: 'u1' },
        error: { showError: false, errorMessage: '' },
        totalAmount: 55.84,
        totalCollected: 0,
        contributors: [],
        sliderDefaults: { percentage: 100, suggestedAmount: 55.84 },
        isLoggedIn: true,
        isLoading: false,
        setAmount: jest.fn(),
        executeContribution: jest.fn(),
        setCurrentView: jest.fn(),
    }),
}))

import { ContributePotInputView } from '../ContributePotInputView'

const renderView = () => render(<ContributePotInputView />, { wrapper: IntlWrapper })

describe('ContributePotInputView — the asked amount', () => {
    it('leads with the amount in the currency the request asks in, dollars second', () => {
        mockRequest = { uuid: 'r1', currency: 'EUR', requestedAmount: '50', tokenSymbol: 'USDC' }
        renderView()

        const headline = screen.getByTestId('request-asked-amount')
        expect(headline).toHaveTextContent('€50 requested')
        expect(headline).toHaveTextContent('$55.84 in dollars')
    })

    it('leads with the currency symbol and no cents on a round amount', () => {
        mockRequest = { uuid: 'r1', currency: 'JPY', requestedAmount: '8200', tokenSymbol: 'USDC' }
        renderView()

        expect(screen.getByTestId('request-asked-amount')).toHaveTextContent('¥8,200 requested')
    })

    it.each([
        ['a dollar request', { uuid: 'r1', currency: null, requestedAmount: null }],
        ['a request that names dollars', { uuid: 'r1', currency: 'USD', requestedAmount: '50' }],
        ['an open-amount request', { uuid: 'r1', currency: 'EUR', requestedAmount: null }],
    ])('says nothing extra on %s', (_, request) => {
        mockRequest = request
        renderView()

        expect(screen.queryByTestId('request-asked-amount')).not.toBeInTheDocument()
    })
})
