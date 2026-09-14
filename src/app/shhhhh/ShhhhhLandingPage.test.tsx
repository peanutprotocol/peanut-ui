import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import ShhhhhLandingPage from './ShhhhhLandingPage'
import { getRedirectUrl } from '@/utils/general.utils'

const mockPush = jest.fn()
const mockFetchUser = jest.fn()
const mockClaim = jest.fn()
const mockInterceptGuestCta = jest.fn<boolean, [handoff?: { dest?: string }]>(() => false)
const mockUseGuestStoreHandoff = jest.fn()
let mockUser: { user: { userId: string } } | null = null
const callOrder: string[] = []

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }))
jest.mock('next-intl', () => ({
    useTranslations: (namespace: string) => (key: string) => {
        const messages = require('@/i18n/app/messages/en.json')
        return `${namespace}.${key}`
            .split('.')
            .reduce<unknown>((value, part) => (value as Record<string, unknown>)[part], messages)
    },
}))
jest.mock('@/context/authContext', () => ({
    useAuth: () => ({ user: mockUser, fetchUser: mockFetchUser, isFetchingUser: false }),
}))
jest.mock('@/hooks/useGuestStoreHandoff', () => ({
    useGuestStoreHandoff: (opts?: { surface?: string }) => {
        mockUseGuestStoreHandoff(opts)
        return {
            interceptGuestCta: (handoff?: { dest?: string }) => {
                callOrder.push('intercept')
                return mockInterceptGuestCta(handoff)
            },
            storeHandoffModal: <div data-testid="store-handoff" />,
        }
    },
}))
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))
jest.mock('@sentry/nextjs', () => ({ captureException: jest.fn() }))
jest.mock('@/components/0_Bruddle/Button', () => ({
    Button: ({
        children,
        onClick,
        disabled,
    }: {
        children: React.ReactNode
        onClick: () => void
        disabled?: boolean
    }) => (
        <button onClick={onClick} disabled={disabled}>
            {children}
        </button>
    ),
}))
jest.mock('@/components/Marketing/HeroBackNav', () => ({ HeroBackNav: () => null }))
jest.mock('@/components/Card/share-asset/ScaledPixelatedCardFace', () => ({ ScaledPixelatedCardFace: () => null }))
jest.mock('@/components/Invites/badge-campaign-context', () => {
    const actual = jest.requireActual('@/components/Invites/badge-campaign-context')
    return {
        ...actual,
        queuePendingBadgeCampaigns: (...args: [readonly string[], number?]) => {
            callOrder.push('queue')
            return actual.queuePendingBadgeCampaigns(...args)
        },
    }
})
jest.mock('@/services/badge-campaigns', () => ({
    claimAndSettlePendingBadgeCampaigns: (...args: unknown[]) => mockClaim(...args),
    isConfirmedBadgeCampaignClaim: (claim: { outcome: string }) =>
        ['awarded', 'already_awarded'].includes(claim.outcome),
}))

beforeEach(() => {
    jest.clearAllMocks()
    callOrder.length = 0
    localStorage.clear()
    window.history.replaceState(null, '', '/shhhhh')
    mockUser = null
    mockInterceptGuestCta.mockReturnValue(false)
    mockClaim.mockResolvedValue({ claims: [], pending: [] })
})

const getCard = () => {
    render(<ShhhhhLandingPage />)
    fireEvent.click(screen.getAllByRole('button', { name: 'Get your card' })[0])
}

it('offers the public product and keeps a guest card destination through signup', async () => {
    getCard()
    expect(screen.getByRole('heading', { level: 1, name: 'Peanut Card' })).toBeInTheDocument()
    expect(screen.queryByText(/waitlist|closed beta|try the door/i)).not.toBeInTheDocument()
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/setup?redirect_uri=%2Fcard'))
})

it('opens a signed-in account directly at /card', async () => {
    mockUser = { user: { userId: 'ordinary-user' } }
    getCard()
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/card'))
    expect(mockClaim).not.toHaveBeenCalled()
})

it('preserves campaign signup attribution with an unconditional card destination', async () => {
    window.history.replaceState(null, '', '/shhhhh?campaign=event-alumni')
    getCard()
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/setup?step=signup&redirect_uri=%2Fcard'))
    expect(getRedirectUrl()).toBe('/card')
    expect(mockClaim).not.toHaveBeenCalled()
})

it.each(['awarded', 'inactive', 'unknown', 'retryable'])(
    'campaign outcome %s does not gate a card application',
    async (outcome) => {
        mockUser = { user: { userId: 'ordinary-user' } }
        window.history.replaceState(null, '', '/shhhhh?campaign=event-alumni')
        mockClaim.mockResolvedValue({ claims: [{ badgeCampaign: 'event-alumni', outcome }], pending: [] })
        getCard()
        await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/card'))
        if (outcome === 'awarded') expect(mockFetchUser).toHaveBeenCalledTimes(1)
    }
)

it('opens the card even when a campaign claim is temporarily unavailable', async () => {
    mockUser = { user: { userId: 'ordinary-user' } }
    window.history.replaceState(null, '', '/shhhhh?campaign=event-alumni')
    mockClaim.mockRejectedValue(new Error('temporary transport failure'))
    getCard()
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/card'))
})

describe('pwa-sunset store hand-off', () => {
    it('hands a guest to the store with /card instead of web signup', async () => {
        mockInterceptGuestCta.mockReturnValue(true)
        getCard()
        await waitFor(() => expect(mockInterceptGuestCta).toHaveBeenCalledWith({ dest: '/card' }))
        expect(mockPush).not.toHaveBeenCalled()
        expect(screen.getByTestId('store-handoff')).toBeInTheDocument()
    })

    it('queues the campaign tag before handing off, so it rides the deferred link', async () => {
        mockInterceptGuestCta.mockReturnValue(true)
        window.history.replaceState(null, '', '/shhhhh?campaign=event-alumni')
        getCard()
        await waitFor(() => expect(callOrder).toEqual(['queue', 'intercept']))
        expect(mockPush).not.toHaveBeenCalled()
    })

    it('never intercepts a signed-in visitor', async () => {
        mockUser = { user: { userId: 'ordinary-user' } }
        mockInterceptGuestCta.mockReturnValue(true)
        getCard()
        await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/card'))
        expect(mockInterceptGuestCta).not.toHaveBeenCalled()
    })
})
