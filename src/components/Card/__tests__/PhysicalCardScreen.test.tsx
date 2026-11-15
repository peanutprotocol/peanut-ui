/**
 * PhysicalCardScreen — waitlist "on the list" copy contract.
 *
 * The joined branch is gated on joinedAt, but the API types position as
 * nullable, so a joined user can have no queue position. Interpolating it
 * blindly renders "You are #null on the list."
 */
import React from 'react'
import { render as rtlRender, screen } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import PhysicalCardScreen from '@/components/Card/PhysicalCardScreen'
import { rainApi } from '@/services/rain'

const render = (ui: React.ReactElement, options?: Omit<Parameters<typeof rtlRender>[1], 'wrapper'>) =>
    rtlRender(ui, { wrapper: IntlWrapper, ...options })

jest.mock('@/context/authContext', () => ({
    useAuth: () => ({ user: { accounts: [] }, fetchUser: jest.fn() }),
}))
// PeanutMascot loads lottie-web, which needs a canvas jsdom does not have.
jest.mock('@/components/Global/PeanutMascot', () => ({
    __esModule: true,
    default: ({ pose, alt }: { pose: string; alt?: string }) => (
        <div data-testid="peanut-mascot" data-pose={pose} aria-label={alt} />
    ),
}))
jest.mock('next/image', () => ({
    __esModule: true,
    default: (props: Record<string, unknown>) => <img alt={String(props.alt ?? '')} />,
}))
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))
jest.mock('@/services/rain', () => ({
    rainApi: { getPhysicalWaitlist: jest.fn(), joinPhysicalWaitlist: jest.fn() },
}))

const mockGet = rainApi.getPhysicalWaitlist as jest.Mock

const renderScreen = () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    return render(
        <IntlWrapper>
            <QueryClientProvider client={queryClient}>
                <PhysicalCardScreen cardId="card-1" last4="4242" />
            </QueryClientProvider>
        </IntlWrapper>
    )
}

describe('PhysicalCardScreen — joined waitlist copy', () => {
    beforeEach(() => jest.clearAllMocks())

    it('shows the queue position when the API returns one', async () => {
        mockGet.mockResolvedValue({ joinedAt: '2026-01-01T00:00:00Z', position: 42 })
        renderScreen()
        expect(await screen.findByText("You're #42 on the list")).toBeInTheDocument()
        expect(screen.getByRole('heading', { name: "You're on the waiting list" })).toBeInTheDocument()
    })

    it('omits the position rather than rendering "#null" when there is none', async () => {
        mockGet.mockResolvedValue({ joinedAt: '2026-01-01T00:00:00Z', position: null })
        renderScreen()
        expect(await screen.findByText("You're on the list")).toBeInTheDocument()
        expect(screen.queryByText(/#/)).not.toBeInTheDocument()
    })

    // Derived rather than hardcoded: the separator is locale-dependent, and the
    // contract is that the copy delegates to toLocaleString, not that it says "1,234".
    it('formats large positions with thousands separators', async () => {
        mockGet.mockResolvedValue({ joinedAt: '2026-01-01T00:00:00Z', position: 1234 })
        renderScreen()
        expect(await screen.findByText(`You're #${(1234).toLocaleString()} on the list`)).toBeInTheDocument()
    })
})

describe('PhysicalCardScreen — not joined yet', () => {
    beforeEach(() => jest.clearAllMocks())

    it('says the card is not available yet, lists the three steps and offers one join action', async () => {
        mockGet.mockResolvedValue({ joinedAt: null, position: null })
        renderScreen()
        expect(await screen.findByText('Not available yet')).toBeInTheDocument()
        expect(screen.getByRole('heading', { name: 'The physical card is on its way' })).toBeInTheDocument()
        expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
            expect.stringContaining('Join the waiting list today'),
            expect.stringContaining("We'll tell you when ordering opens"),
            expect.stringContaining("Order it and we'll ship it to you"),
        ])
        expect(screen.getByRole('button', { name: 'Join the waiting list' })).toBeInTheDocument()
    })
})
