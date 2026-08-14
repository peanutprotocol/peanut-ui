import { fireEvent, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import posthog from 'posthog-js'
import ProfileHeader from '../ProfileHeader'
import { ANALYTICS_EVENTS, REFERRAL_SOURCES } from '@/constants/analytics.consts'
import { renderWithIntl } from '@/test-utils/intl'

let mockAuthUsername: string | undefined
const mockShareButton = jest.fn()

jest.mock('@/context/authContext', () => ({
    useAuth: () => ({ user: mockAuthUsername ? { user: { username: mockAuthUsername } } : null }),
}))
jest.mock('@/hooks/useIdentityVerification', () => ({
    useIdentityVerification: () => ({ isVerified: false }),
}))
// The share mechanics (copy, toast, share sheet, AbortError) belong to
// ShareButton's own suite; here only the url + onSuccess wiring is under test.
jest.mock('@/components/Global/ShareButton', () => ({
    __esModule: true,
    default: (props: { children?: ReactNode; onSuccess?: () => void }) => {
        mockShareButton(props)
        return <button onClick={props.onSuccess}>{props.children}</button>
    },
}))
jest.mock('@/components/Global/Icons/Icon', () => ({ Icon: () => null }))
jest.mock('@/components/Profile/AvatarWithBadge', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Global/CopyToClipboard', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/UserHeader', () => ({
    VerifiedUserLabel: ({ name }: { name: string }) => <span>{name}</span>,
}))
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))

// Pin the origin so the shared value (and the `https://`-stripped pill label) is
// deterministic — `shareableUrl` reads window.location.origin under jsdom.
const ORIGIN = 'https://peanut.example.org'
const originalLocation = window.location

beforeAll(() => {
    Object.defineProperty(window, 'location', { value: new URL(ORIGIN), writable: true })
})

beforeEach(() => {
    jest.clearAllMocks()
    mockAuthUsername = 'satoshi'
})

afterAll(() => {
    Object.defineProperty(window, 'location', { value: originalLocation, writable: true })
})

const sharePill = () => screen.queryByRole('button', { name: 'peanut.example.org/satoshi' })

describe('ProfileHeader share pill', () => {
    // Wrong-attribution guard: `showShareButton` defaults to true, so a caller
    // on someone else's profile would otherwise hand out that other handle. The
    // unresolved case would show `peanut.me/anonymous`.
    test.each([
        ['the signed-in user own profile', 'satoshi', 'satoshi', true],
        ['someone else profile', 'hal', 'satoshi', false],
        ['a profile while auth is unresolved', undefined, 'anonymous', false],
    ] as Array<[string, string | undefined, string, boolean]>)(
        'on %s the pill is rendered: %s → %s',
        (_label, authUsername, profileUsername, visible) => {
            mockAuthUsername = authUsername
            renderWithIntl(<ProfileHeader name="Satoshi" username={profileUsername} showShareButton />)

            if (visible) expect(sharePill()).toBeInTheDocument()
            else expect(screen.queryByRole('button')).not.toBeInTheDocument()
        }
    )

    // The [...recipient] route reuses the component instance across profile
    // navigations, so the impression must re-arm when the pill hides — a
    // mount-scoped latch undercounts self → other → self round trips.
    it('fires the impression once per visibility, re-armed when the pill hides', () => {
        const shownCalls = () =>
            (posthog.capture as jest.Mock).mock.calls.filter(([event]) => event === ANALYTICS_EVENTS.REFERRAL_CTA_SHOWN)

        const { rerender } = renderWithIntl(<ProfileHeader name="Satoshi" username="satoshi" showShareButton />)
        expect(shownCalls()).toHaveLength(1)

        // same visibility period: no double fire
        rerender(<ProfileHeader name="Satoshi" username="satoshi" showShareButton />)
        expect(shownCalls()).toHaveLength(1)

        // navigate to someone else's profile (pill hides), then back to self
        rerender(<ProfileHeader name="Hal" username="hal" showShareButton />)
        expect(shownCalls()).toHaveLength(1)
        rerender(<ProfileHeader name="Satoshi" username="satoshi" showShareButton />)
        expect(shownCalls()).toHaveLength(2)
    })

    it('shares the profile url and captures the click only on a successful share', () => {
        renderWithIntl(<ProfileHeader name="Satoshi" username="satoshi" showShareButton />)

        expect(mockShareButton).toHaveBeenCalledWith(expect.objectContaining({ url: `${ORIGIN}/satoshi` }))
        expect(posthog.capture).not.toHaveBeenCalledWith(ANALYTICS_EVENTS.REFERRAL_CTA_CLICKED, expect.anything())

        fireEvent.click(sharePill()!)

        expect(posthog.capture).toHaveBeenCalledWith(ANALYTICS_EVENTS.REFERRAL_CTA_CLICKED, {
            source: REFERRAL_SOURCES.PROFILE_HEADER,
            link_type: 'profile',
        })
    })
})
