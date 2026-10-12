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
