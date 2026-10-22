import { render, screen, waitFor } from '@testing-library/react'
import PaymentPage from '../client'
import { SCAN_ID_PARAM, takeScannedDestination } from '@/features/withdraw/destination'

// The dispatch is under test: a request link (?id=) must land every payer —
// signed-in or not — on the one all-methods screen, with no bank-first
// excursion in front of it; an address link sends a signed-in user into the
// crypto withdrawal.

const searchParams = new URLSearchParams()
const mockReplace = jest.fn()
jest.mock('next/navigation', () => ({
    useSearchParams: () => searchParams,
    useRouter: () => ({ push: jest.fn(), replace: mockReplace }),
}))
jest.mock('@/app/actions/ens', () => ({ resolveEns: jest.fn() }))
jest.mock('@/utils/api-fetch', () => ({ serverFetch: jest.fn() }))

let authUser: { user: { userId: string } } | null = null
let isFetchingUser = false
jest.mock('@/context/authContext', () => ({
    useAuth: () => ({ user: authUser, isFetchingUser }),
}))

jest.mock('@/features/payments/flows/contribute-pot/ContributePotPageWrapper', () => ({
    ContributePotPageWrapper: ({ requestId }: { requestId: string }) => (
        <div data-testid="contribute-pot">{requestId}</div>
    ),
}))
jest.mock('@/features/payments/flows/semantic-request/SemanticRequestPageWrapper', () => ({
    SemanticRequestPageWrapper: () => <div data-testid="semantic-request" />,
}))
jest.mock('@/components/Profile/components/PublicProfile', () => ({
    __esModule: true,
    default: () => <div data-testid="public-profile" />,
}))
jest.mock('@/components/Username/ValidatedUsernameWrapper', () => ({
    ValidatedUsernameWrapper: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

beforeEach(() => {
    searchParams.forEach((_, key) => searchParams.delete(key))
    authUser = null
    isFetchingUser = false
    mockReplace.mockReset()
})

describe('PaymentPage request-pot dispatch', () => {
    it('lands a signed-out payer directly on the unified all-methods screen', () => {
        searchParams.set('id', 'req-1')

        render(<PaymentPage recipient={['alice']} />)

        expect(screen.getByTestId('contribute-pot')).toHaveTextContent('req-1')
    })

    it('lands a signed-in payer on the same screen', () => {
        authUser = { user: { userId: 'u-1' } }
        searchParams.set('id', 'req-2')

        render(<PaymentPage recipient={['alice']} />)

        expect(screen.getByTestId('contribute-pot')).toHaveTextContent('req-2')
    })
})

// A signed-in visit to an address link is the user's own payout, so it goes
// into the crypto withdrawal, as a scan of one does (TASK-23974). The address
// never enters the URL. Guests keep the payment page.
describe('PaymentPage for an address link', () => {
    const ADDRESS = '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed'
    const SIGNED_IN = { user: { userId: 'u-1' } }

    it('opens the payment page for a guest', () => {
        render(<PaymentPage recipient={[ADDRESS]} />)

        expect(screen.getByTestId('semantic-request')).toBeInTheDocument()
        expect(mockReplace).not.toHaveBeenCalled()
    })

    it('sends a signed-in user into the crypto withdrawal, with the address out of the URL', async () => {
        authUser = SIGNED_IN

        render(<PaymentPage recipient={[ADDRESS]} />)

        await waitFor(() => expect(mockReplace).toHaveBeenCalledTimes(1))
        const entryUrl: string = mockReplace.mock.calls[0][0]
        expect(entryUrl).toMatch(new RegExp(`^/withdraw\\?step=amount&method=crypto&${SCAN_ID_PARAM}=`))
        expect(entryUrl.toLowerCase()).not.toContain(ADDRESS.toLowerCase())
        const scanId = new URLSearchParams(entryUrl.split('?')[1]).get(SCAN_ID_PARAM)
        expect(takeScannedDestination(scanId)).toMatchObject({ address: ADDRESS })
        expect(screen.queryByTestId('semantic-request')).not.toBeInTheDocument()
    })

    it('shows neither page while the session loads', () => {
        isFetchingUser = true

        render(<PaymentPage recipient={[ADDRESS]} />)

        expect(screen.getByRole('status')).toBeInTheDocument()
        expect(screen.queryByTestId('semantic-request')).not.toBeInTheDocument()
        expect(mockReplace).not.toHaveBeenCalled()
    })

    it('keeps the payment page for a link the withdrawal cannot pay as written', async () => {
        authUser = SIGNED_IN

        render(<PaymentPage recipient={[`${ADDRESS}@137`, '1ETH']} />)

        expect(await screen.findByTestId('semantic-request')).toBeInTheDocument()
        expect(mockReplace).not.toHaveBeenCalled()
    })

    it('keeps the payment page for an existing charge', () => {
        authUser = SIGNED_IN
        searchParams.set('chargeId', 'charge-1')

        render(<PaymentPage recipient={[ADDRESS]} />)

        expect(screen.getByTestId('semantic-request')).toBeInTheDocument()
        expect(mockReplace).not.toHaveBeenCalled()
    })

    it('keeps the payment page for a username with an amount', () => {
        authUser = SIGNED_IN

        render(<PaymentPage recipient={['alice', '10USDC']} />)

        expect(screen.getByTestId('semantic-request')).toBeInTheDocument()
        expect(mockReplace).not.toHaveBeenCalled()
    })
})
