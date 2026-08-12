import { fireEvent, screen } from '@testing-library/react'
import type { ComponentProps, ReactNode } from 'react'
import posthog from 'posthog-js'
import PublicProfile from '../PublicProfile'
import { ANALYTICS_EVENTS, REFERRAL_SOURCES } from '@/constants/analytics.consts'
import { renderWithIntl } from '@/test-utils/intl'
import en from '@/i18n/app/messages/en.json'

const mockPush = jest.fn()
const mockSaveToCookie = jest.fn()
const mockGetByUsername = jest.fn()
const mockInterceptGuestCta = jest.fn(() => false)
let mockAuth: { user: null | { user: { username: string; hasAppAccess: boolean } }; isFetchingUser: boolean }

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush, back: jest.fn() }) }))
jest.mock('@/context/authContext', () => ({ useAuth: () => mockAuth }))
jest.mock('@/services/users', () => ({ usersApi: { getByUsername: (u: string) => mockGetByUsername(u) } }))
jest.mock('@/hooks/useGuestStoreHandoff', () => ({
    useGuestStoreHandoff: () => ({
        interceptGuestCta: () => mockInterceptGuestCta(),
        storeHandoffModal: <div data-testid="store-handoff" />,
    }),
}))
jest.mock('@/utils/general.utils', () => {
    const actual = jest.requireActual('@/utils/general.utils')
    return { ...actual, saveToCookie: (...args: unknown[]) => mockSaveToCookie(...args) }
})
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))

// Stubbed neighbours — this suite is about the guest door, not the page furniture.
jest.mock('../ProfileHeader', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Badges/BadgesRow', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Home/HomeHistory', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Global/NavHeader', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Global/ActionModal', () => ({
    __esModule: true,
    // Renders description + content when visible so the guest Request-gate
    // modal (the second crediting door) is assertable.
    default: ({ visible, description, content }: { visible?: boolean; description?: string; content?: ReactNode }) =>
        visible ? (
            <div data-testid="action-modal">
                <p>{description}</p>
                {content}
            </div>
        ) : null,
}))
jest.mock('@/components/Global/ShareButton', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Global/Icons/Icon', () => ({ Icon: () => null }))
jest.mock('next/image', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/0_Bruddle/Button', () => ({
    Button: ({ children, onClick }: ComponentProps<'button'>) => <button onClick={onClick}>{children}</button>,
}))

const JOIN_CTA = en.profile.publicProfile.joinCta

beforeEach(() => {
    jest.clearAllMocks()
    mockAuth = { user: null, isFetchingUser: false }
    mockInterceptGuestCta.mockReturnValue(false)
    mockGetByUsername.mockResolvedValue(null)
})

describe('PublicProfile guest door', () => {
    it('credits the profile owner and routes the guest into /invite', async () => {
        renderWithIntl(<PublicProfile username="Satoshi" />)

        expect(
            await screen.findByText(en.profile.publicProfile.invitedLine.replace('{username}', 'Satoshi'))
        ).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: JOIN_CTA }))

        expect(mockSaveToCookie).toHaveBeenCalledWith('inviteCode', 'satoshi')
        expect(posthog.capture).toHaveBeenCalledWith(ANALYTICS_EVENTS.REFERRAL_CTA_CLICKED, {
            source: REFERRAL_SOURCES.PUBLIC_PROFILE_GUEST,
            link_type: 'invite_code',
        })
        expect(mockPush).toHaveBeenCalledWith('/invite?code=satoshi')
    })

    it('still writes the invite cookie when the store handoff swallows the click', async () => {
        mockInterceptGuestCta.mockReturnValue(true)
        renderWithIntl(<PublicProfile username="Satoshi" />)

        fireEvent.click(await screen.findByRole('button', { name: JOIN_CTA }))

        // the handoff leaves the page for the app store, so the code has to be
        // persisted before the intercept runs
        expect(mockSaveToCookie).toHaveBeenCalledWith('inviteCode', 'satoshi')
        expect(posthog.capture).toHaveBeenCalledWith(ANALYTICS_EVENTS.REFERRAL_CTA_CLICKED, {
            source: REFERRAL_SOURCES.PUBLIC_PROFILE_GUEST,
            link_type: 'invite_code',
        })
        expect(mockPush).not.toHaveBeenCalled()
    })

    it('shows no join cta to a logged-in visitor', async () => {
        mockAuth = { user: { user: { username: 'hal', hasAppAccess: true } }, isFetchingUser: false }
        renderWithIntl(<PublicProfile username="satoshi" isLoggedIn />)

        expect(await screen.findByRole('button', { name: en.navigation.send })).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: JOIN_CTA })).not.toBeInTheDocument()
        expect(posthog.capture).not.toHaveBeenCalledWith(ANALYTICS_EVENTS.REFERRAL_CTA_SHOWN, expect.anything())
    })

    it('holds the impression back until auth has settled', async () => {
        mockAuth = { user: null, isFetchingUser: true }
        renderWithIntl(<PublicProfile username="satoshi" />)

        await screen.findByRole('button', { name: JOIN_CTA })
        expect(posthog.capture).not.toHaveBeenCalledWith(ANALYTICS_EVENTS.REFERRAL_CTA_SHOWN, expect.anything())
    })

    it('fires the referral impression once auth has settled on a guest', async () => {
        renderWithIntl(<PublicProfile username="satoshi" />)

        await screen.findByRole('button', { name: JOIN_CTA })
        expect(posthog.capture).toHaveBeenCalledWith(ANALYTICS_EVENTS.REFERRAL_CTA_SHOWN, {
            source: REFERRAL_SOURCES.PUBLIC_PROFILE_GUEST,
            link_type: 'invite_code',
        })
    })

    it('routes a guest through the crediting door from the Request-gate modal too', async () => {
        renderWithIntl(<PublicProfile username="Satoshi" />)

        // Request opens the invite-gate modal for guests — it must offer the
        // same crediting door as the join card, not the old beg-for-an-invite
        // dead end.
        fireEvent.click(await screen.findByRole('button', { name: en.navigation.request }))
        const modal = await screen.findByTestId('action-modal')
        expect(modal).toHaveTextContent(en.profile.publicProfile.invitedLine.replace('{username}', 'Satoshi'))

        const joinButtons = screen.getAllByRole('button', { name: JOIN_CTA })
        fireEvent.click(joinButtons[joinButtons.length - 1])

        expect(mockSaveToCookie).toHaveBeenCalledWith('inviteCode', 'satoshi')
        expect(mockPush).toHaveBeenCalledWith('/invite?code=satoshi')
    })
})
