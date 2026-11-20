import { fireEvent, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderWithIntl } from '@/test-utils/intl'
import { CountryWaitlist } from '../CountryWaitlist'

const mockRequest = jest.fn()
const mockSignIn = jest.fn()
let mockUser: { user: { userId: string } } | null = { user: { userId: 'qa' } }
jest.mock('@/services/country-waitlist', () => ({ countryWaitlist: (...args: unknown[]) => mockRequest(...args) }))
jest.mock('@/context/authContext', () => ({ useAuth: () => ({ user: mockUser, userId: mockUser?.user.userId }) }))
jest.mock('@/context/ModalsContext', () => ({
    useModalsContext: () => ({ setIsSignInModalOpen: mockSignIn }),
    useModalsContextOptional: () => undefined,
}))
jest.mock('@/components/Global/Drawer', () => ({
    Drawer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DrawerContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DrawerHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DrawerTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
    DrawerDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
}))
jest.mock('next/image', () => ({ __esModule: true, default: () => null }))

const render = (queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })) =>
    renderWithIntl(
        <QueryClientProvider client={queryClient}>
            <CountryWaitlist countryCode="AR" countryName="Argentina" flow="send" onClose={jest.fn()} />
        </QueryClientProvider>
    )
beforeEach(() => {
    jest.clearAllMocks()
    mockUser = { user: { userId: 'qa' } }
    mockRequest.mockImplementation((_country, _flow, method) =>
        Promise.resolve({ joinedAt: method === 'POST' ? '2026-09-17T12:00:00Z' : null })
    )
})
it('confirms only a persisted signup', async () => {
    render()
    const button = await screen.findByRole('button', { name: 'I want this' })
    await waitFor(() => expect(button).not.toBeDisabled())
    fireEvent.click(button)
    await screen.findByText('Thanks')
    expect(mockRequest).toHaveBeenCalledWith('AR', 'send', 'POST')
    // No subscription backend sends anything to these rows (TASK-24171), so no notify promise.
    expect(screen.queryByText(/let you know|notify|waitlist/i)).not.toBeInTheDocument()
})
it('does not show success when signup fails', async () => {
    mockRequest.mockImplementation((_country, _flow, method) =>
        method === 'POST' ? Promise.reject(new Error('offline')) : Promise.resolve({ joinedAt: null })
    )
    render()
    const button = await screen.findByRole('button', { name: 'I want this' })
    await waitFor(() => expect(button).not.toBeDisabled())
    fireEvent.click(button)
    await screen.findByText('Could not save your request. Please try again.')
    expect(screen.queryByText('Thanks')).not.toBeInTheDocument()
})
it('asks guests to sign in without storing an anonymous signup', () => {
    mockUser = null
    render()
    fireEvent.click(screen.getByRole('button', { name: 'I want this' }))
    expect(mockSignIn).toHaveBeenCalledWith(true)
    expect(mockRequest).not.toHaveBeenCalled()
})

it('keeps signup confirmation in the authenticated user cache', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const first = render(client)
    fireEvent.click(await screen.findByRole('button', { name: 'I want this' }))
    await screen.findByText('Thanks')
    expect(client.getQueryData(['country-waitlist', 'qa', 'AR', 'send'])).toEqual({ joinedAt: '2026-09-17T12:00:00Z' })
    first.unmount()
    mockUser = { user: { userId: 'different-user' } }
    render(client)
    await screen.findByRole('button', { name: 'I want this' })
    expect(screen.queryByText('Thanks')).not.toBeInTheDocument()
    expect(client.getQueryData(['country-waitlist', 'different-user', 'AR', 'send'])).toEqual({ joinedAt: null })
})
