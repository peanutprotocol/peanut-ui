import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import type { ComponentProps, ReactNode } from 'react'
import { renderWithIntl } from '@/test-utils/intl'
import en from '@/i18n/app/messages/en.json'
import ShhhhhLandingPage from './ShhhhhLandingPage'

const mockPush = jest.fn()
const mockInterceptGuestCta = jest.fn<boolean, [handoff?: { dest?: string; invite?: string }]>(() => false)
const mockUseGuestStoreHandoff = jest.fn()
const mockGetInfo = jest.fn()
const mockJoinWaitlist = jest.fn()

let mockAuth: { user: null | { user: { userId: string } }; isFetchingUser?: boolean; fetchUser: jest.Mock }
let mockSearch = ''
let mockStoreHandoffModal: ReactNode = <div data-testid="store-handoff" />
const mockQueuePendingBadgeCampaigns = jest.fn((campaigns: readonly string[], _expiryDays?: number) => [...campaigns])
const callOrder: string[] = []

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }))
jest.mock('@/context/authContext', () => ({ useAuth: () => mockAuth }))
jest.mock('@/services/card', () => ({
    cardApi: { getInfo: () => mockGetInfo(), joinWaitlist: () => mockJoinWaitlist() },
}))
jest.mock('@/hooks/useGuestStoreHandoff', () => ({
    useGuestStoreHandoff: (opts?: { surface?: string }) => {
        mockUseGuestStoreHandoff(opts)
        return {
            interceptGuestCta: (handoff?: { dest?: string }) => {
                callOrder.push('intercept')
                return mockInterceptGuestCta(handoff)
            },
            storeHandoffModal: mockStoreHandoffModal,
        }
    },
}))
jest.mock('@/components/Invites/badge-campaign-context', () => {
    const actual = jest.requireActual('@/components/Invites/badge-campaign-context')
    return {
        ...actual,
        queuePendingBadgeCampaigns: (...args: [readonly string[], number?]) => {
            callOrder.push('queue')
            return mockQueuePendingBadgeCampaigns(...args)
        },
    }
})
jest.mock('@/services/badge-campaigns', () => ({
    claimAndSettlePendingBadgeCampaigns: jest.fn(async (campaigns: readonly string[]) => ({
        claims: campaigns.map((badgeCampaign) => ({ badgeCampaign, badgeCode: 'OTHER', outcome: 'awarded' })),
        pending: [],
    })),
    isConfirmedBadgeCampaignClaim: (claim: { outcome: string }) => claim.outcome === 'awarded',
}))
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))
jest.mock('@sentry/nextjs', () => ({ captureException: jest.fn() }))

// Page furniture — this suite is about the door's routing branch, nothing else.
jest.mock('@/components/LandingPage', () => ({ Marquee: () => null }))
jest.mock('@/components/LandingPage/ScarcityCounter', () => ({ ScarcityCounter: () => null }))
jest.mock('@/components/Card/share-asset/PixelatedCardFace', () => ({ PixelatedCardFace: () => null }))
jest.mock('@/components/Badges/badge.utils', () => ({ getBadgeIcon: () => '/badge.svg' }))
jest.mock('next/image', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/0_Bruddle/Button', () => ({
    Button: ({ children, onClick, disabled }: ComponentProps<'button'>) => (
        <button onClick={onClick} disabled={disabled}>
            {children}
        </button>
    ),
}))
jest.mock('framer-motion', () => ({
    AnimatePresence: ({ children }: { children?: ReactNode }) => <>{children}</>,
    motion: new Proxy(
        {},
        {
            get:
                (_target, tag: string) =>
                ({ children, ...props }: { children?: ReactNode }) => {
                    const Tag = tag as 'div'
                    const {
                        initial: _i,
                        animate: _a,
                        exit: _e,
                        transition: _t,
                        whileInView: _w,
                        ...rest
                    } = props as Record<string, unknown>
                    return <Tag {...rest}>{children}</Tag>
                },
        }
    ),
}))

const DOOR = en.shhhhh.hero.tryTheDoor
const WAITLIST_LINK = en.shhhhh.hero.orJoinWaitlist
const SETUP_ROUTE = `/setup?redirect_uri=${encodeURIComponent('/card')}`

const clickDoor = () => fireEvent.click(screen.getAllByText(DOOR)[0])

// the sticky bar only mounts past 300px and short of the page bottom; jsdom
// reports a zero-height body, so fake a long scrolled page.
const scrollPastStickyThreshold = () => {
    Object.defineProperty(document.body, 'scrollHeight', { value: 5000, configurable: true })
    Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true })
    Object.defineProperty(window, 'scrollY', { value: 900, configurable: true })
    fireEvent.scroll(window)
}

beforeEach(() => {
    jest.clearAllMocks()
    callOrder.length = 0
    mockStoreHandoffModal = <div data-testid="store-handoff" />
    mockQueuePendingBadgeCampaigns.mockImplementation((campaigns: readonly string[]) => [...campaigns])
    mockAuth = { user: null, isFetchingUser: false, fetchUser: jest.fn().mockResolvedValue(null) }
    mockSearch = ''
    mockInterceptGuestCta.mockReturnValue(false)
    mockGetInfo.mockResolvedValue({ hasCardAccess: false, isPublicLaunched: false })
    mockJoinWaitlist.mockResolvedValue({ position: 42 })
    window.history.replaceState({}, '', '/shhhhh')
})

const render = () => {
    if (mockSearch) window.history.replaceState({}, '', `/shhhhh?${mockSearch}`)
    return renderWithIntl(<ShhhhhLandingPage />)
}

describe('ShhhhhLandingPage door — pwa-sunset store hand-off', () => {
    it('asks for the landing-door surface and counts the settled guest impression', () => {
        render()
        expect(mockUseGuestStoreHandoff).toHaveBeenCalledWith({
            surface: 'landing_door',
            trackImpressionWhenGuest: true,
        })
    })

    it('does not count the impression while auth is still resolving', () => {
        mockAuth = { user: null, isFetchingUser: true, fetchUser: jest.fn().mockResolvedValue(null) }
        render()
        expect(mockUseGuestStoreHandoff).toHaveBeenCalledWith({
            surface: 'landing_door',
            trackImpressionWhenGuest: false,
        })
    })

    it('does nothing on a tap taken during the pre-auth flash', async () => {
        mockAuth = { user: null, isFetchingUser: true, fetchUser: jest.fn().mockResolvedValue(null) }
        mockInterceptGuestCta.mockReturnValue(true)
        render()

        clickDoor()

        await waitFor(() => expect(mockGetInfo).not.toHaveBeenCalled())
        expect(mockInterceptGuestCta).not.toHaveBeenCalled()
        expect(mockPush).not.toHaveBeenCalled()
    })

    it('queues the campaign tag before handing off, so it rides the deferred link', async () => {
        mockSearch = 'campaign=acai'
        mockInterceptGuestCta.mockReturnValue(true)
        render()

        clickDoor()

        await waitFor(() => expect(mockInterceptGuestCta).toHaveBeenCalled())
        expect(mockQueuePendingBadgeCampaigns).toHaveBeenCalledTimes(1)
        expect(mockQueuePendingBadgeCampaigns.mock.calls[0][1]).toBe(30)
        expect(callOrder).toEqual(['queue', 'intercept'])
    })

    it('hides the sticky mobile bar while the hand-off modal is open', async () => {
        // the sticky bar is fixed z-50 and would cover the QR sheet's own
        // close / store buttons on a narrow desktop-mode phone
        mockStoreHandoffModal = null
        render()
        scrollPastStickyThreshold()
        const withoutModal = await waitFor(() => {
            const count = screen.getAllByText(DOOR).length
            expect(count).toBeGreaterThan(2)
            return count
        })

        mockStoreHandoffModal = <div data-testid="store-handoff" />
        cleanup()
        render()
        scrollPastStickyThreshold()

        await waitFor(() => expect(screen.getByTestId('store-handoff')).toBeInTheDocument())
        expect(screen.getAllByText(DOOR).length).toBe(withoutModal - 1)
    })

    it('hands a signed-out visitor to the store with /card instead of web signup', async () => {
        mockInterceptGuestCta.mockReturnValue(true)
        render()

        clickDoor()

        await waitFor(() => expect(mockInterceptGuestCta).toHaveBeenCalledWith({ dest: '/card' }))
        expect(mockPush).not.toHaveBeenCalled()
        expect(screen.getByTestId('store-handoff')).toBeInTheDocument()
    })

    it('hands off from the "or join the waitlist" link too', async () => {
        mockInterceptGuestCta.mockReturnValue(true)
        render()

        fireEvent.click(screen.getByText(WAITLIST_LINK))

        await waitFor(() => expect(mockInterceptGuestCta).toHaveBeenCalledWith({ dest: '/card' }))
        expect(mockPush).not.toHaveBeenCalled()
    })

    it('hands off before the campaign signup route when the link carries campaign tags', async () => {
        mockSearch = 'campaign=acai'
        mockInterceptGuestCta.mockReturnValue(true)
        render()

        clickDoor()

        await waitFor(() => expect(mockInterceptGuestCta).toHaveBeenCalledWith({ dest: '/card' }))
        expect(mockPush).not.toHaveBeenCalled()
    })

    it('keeps the web signup route when the flag is off', async () => {
        render()

        clickDoor()

        await waitFor(() => expect(mockPush).toHaveBeenCalledWith(SETUP_ROUTE))
    })

    it('never intercepts a signed-in visitor — they still join the waitlist', async () => {
        mockAuth = {
            user: { user: { userId: 'u1' } },
            isFetchingUser: false,
            fetchUser: jest.fn().mockResolvedValue(null),
        }
        mockInterceptGuestCta.mockReturnValue(true)
        render()

        clickDoor()

        await waitFor(() => expect(mockJoinWaitlist).toHaveBeenCalled())
        expect(mockInterceptGuestCta).not.toHaveBeenCalled()
        expect(mockPush).not.toHaveBeenCalledWith(SETUP_ROUTE)
    })
})
