import { render, screen } from '@testing-library/react'
import PaymentPage from '../client'

// Only the request-pot dispatch is under test: a request link (?id=) must land
// every payer — signed-in or not — on the one all-methods screen, with no
// bank-first excursion in front of it.

const searchParams = new URLSearchParams()
jest.mock('next/navigation', () => ({
    useSearchParams: () => searchParams,
    useRouter: () => ({ push: jest.fn() }),
}))

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

// A scanned EVM address now goes into the crypto withdrawal (TASK-23974), but a
// shared payment link to one still opens the payment page, signed in or not.
describe('PaymentPage for an address link', () => {
    it.each([
        ['a signed-out payer', null],
        ['a signed-in payer', { user: { userId: 'u-1' } }],
    ])('opens the payment page for %s', (_case, user) => {
        authUser = user

        render(<PaymentPage recipient={['0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed']} />)

        expect(screen.getByTestId('semantic-request')).toBeInTheDocument()
    })
})
