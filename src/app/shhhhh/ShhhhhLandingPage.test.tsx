import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import ShhhhhLandingPage from './ShhhhhLandingPage'
import { getRedirectUrl } from '@/utils/general.utils'

const mockPush = jest.fn()
const mockFetchUser = jest.fn()
const mockClaim = jest.fn()
let mockUser: { user: { userId: string } } | null = null

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }))
jest.mock('next-intl', () => ({
    useTranslations: (namespace: string) => (key: string) => {
        const messages = require('@/i18n/app/messages/en.json')
        return `${namespace}.${key}`
            .split('.')
            .reduce<unknown>((value, part) => (value as Record<string, unknown>)[part], messages)
    },
}))
jest.mock('@/context/authContext', () => ({ useAuth: () => ({ user: mockUser, fetchUser: mockFetchUser }) }))
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
jest.mock('@/components/Card/share-asset/ScaledPixelatedCardFace', () => ({ ScaledPixelatedCardFace: () => null }))
jest.mock('@/services/badge-campaigns', () => ({
    claimAndSettlePendingBadgeCampaigns: (...args: unknown[]) => mockClaim(...args),
    isConfirmedBadgeCampaignClaim: (claim: { outcome: string }) =>
        ['awarded', 'already_awarded'].includes(claim.outcome),
}))

beforeEach(() => {
    jest.clearAllMocks()
    localStorage.clear()
    window.history.replaceState(null, '', '/shhhhh')
    mockUser = null
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
