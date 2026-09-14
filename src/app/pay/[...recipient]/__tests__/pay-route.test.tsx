import { render } from '@testing-library/react'
import PayRoute from '../client'

const mockReplace = jest.fn()
jest.mock('next/navigation', () => ({
    useRouter: () => ({ replace: mockReplace, push: jest.fn(), back: jest.fn() }),
}))

const query: Record<string, string | null> = {}
jest.mock('nuqs', () => ({
    useQueryStates: () => [query, jest.fn()],
    parseAsString: {},
}))

jest.mock('@/app/[...recipient]/client', () => ({
    __esModule: true,
    default: ({ recipient }: { recipient: string[] }) => <div data-testid="payment-page">{recipient.join('/')}</div>,
}))

jest.mock('@/utils/capacitor', () => ({ isCapacitor: () => false }))

describe('PayRoute', () => {
    beforeEach(() => {
        mockReplace.mockClear()
        for (const key of Object.keys(query)) delete query[key]
    })

    // The "My QR" payload is a bare /pay/<user>. It predates the request-link move
    // and must keep handing off to the send flow rather than rendering a payment page.
    it('hands a bare recipient to the send flow', () => {
        const { queryByTestId } = render(<PayRoute recipient={['alice']} />)
        expect(mockReplace).toHaveBeenCalledWith('/send/alice')
        expect(queryByTestId('payment-page')).toBeNull()
    })

    it('renders the payment page for a request-pot link', () => {
        query.id = 'req-123'
        const { getByTestId } = render(<PayRoute recipient={['alice']} />)
        expect(getByTestId('payment-page')).toHaveTextContent('alice')
        expect(mockReplace).not.toHaveBeenCalled()
    })

    it('renders the payment page for a charge link', () => {
        query.chargeId = 'charge-123'
        render(<PayRoute recipient={['alice']} />)
        expect(mockReplace).not.toHaveBeenCalled()
    })

    it('renders the payment page for an amount-shaped link with no charge', () => {
        const { getByTestId } = render(<PayRoute recipient={['alice', '10USDC']} />)
        expect(getByTestId('payment-page')).toHaveTextContent('alice/10USDC')
        expect(mockReplace).not.toHaveBeenCalled()
    })
})
