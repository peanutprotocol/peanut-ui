import { fireEvent, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import posthog from 'posthog-js'
import ProfileHeader from '../ProfileHeader'
import { ANALYTICS_EVENTS, REFERRAL_SOURCES } from '@/constants/analytics.consts'
import { renderWithIntl } from '@/test-utils/intl'

let mockAuthUsername: string | undefined
const mockShareButton = jest.fn()
const mockCopy = jest.fn()
const mockToastInfo = jest.fn()
const mockToastError = jest.fn()

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
jest.mock('@/utils/clipboard.utils', () => ({ copyTextToClipboard: (...args: unknown[]) => mockCopy(...args) }))
jest.mock('@/components/0_Bruddle/Toast', () => ({
    useToast: () => ({ info: mockToastInfo, error: mockToastError }),
}))
jest.mock('@/components/Global/Icons/Icon', () => ({ Icon: () => null }))
jest.mock('@/components/Profile/AvatarWithBadge', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/UserHeader', () => ({
    VerifiedUserLabel: ({ name }: { name: string }) => <span data-testid="profile-name">{name}</span>,
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
    mockCopy.mockResolvedValue(true)
})

afterAll(() => {
    Object.defineProperty(window, 'location', { value: originalLocation, writable: true })
})

// the pill's three hit areas: the handle copies, the share icon shares, the avatar opens the picker
const copyButton = () => screen.queryByRole('button', { name: /^Copy profile link peanut\.example\.org\/\s*satoshi$/ })
const shareButton = () => screen.queryByRole('button', { name: 'Share' })

describe('ProfileHeader pill', () => {
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

            if (visible) {
                expect(copyButton()).toBeInTheDocument()
                expect(shareButton()).toBeInTheDocument()
            } else expect(screen.queryByRole('button')).not.toBeInTheDocument()
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

    // You already know your own name: the pill spells out the handle and the
    // full name lives one tap away in personal details.
    it('shows the handle and never the full name on the self profile', () => {
        renderWithIntl(<ProfileHeader name="Satoshi Nakamoto" username="satoshi" showShareButton />)

        expect(copyButton()).toHaveTextContent('peanut.example.org/satoshi')
        expect(screen.queryByTestId('profile-name')).not.toBeInTheDocument()
        expect(screen.queryByText('Satoshi Nakamoto')).not.toBeInTheDocument()
    })

    it('keeps the stacked header with the name row on someone else profile', () => {
        mockAuthUsername = 'hal'
        renderWithIntl(<ProfileHeader name="Satoshi Nakamoto" username="satoshi" showShareButton />)

        expect(screen.getByTestId('profile-name')).toHaveTextContent('Satoshi Nakamoto')
        expect(copyButton()).not.toBeInTheDocument()
    })

    it('copies the profile url from the handle and says so, without counting a share', async () => {
        renderWithIntl(<ProfileHeader name="Satoshi" username="satoshi" showShareButton />)

        fireEvent.click(copyButton()!)

        expect(mockCopy).toHaveBeenCalledWith(`${ORIGIN}/satoshi`)
        await waitFor(() => expect(mockToastInfo).toHaveBeenCalledWith('Link copied'))
        expect(posthog.capture).not.toHaveBeenCalledWith(ANALYTICS_EVENTS.REFERRAL_CTA_CLICKED, expect.anything())
    })

    it('says so when the copy fails', async () => {
        mockCopy.mockResolvedValue(false)
        renderWithIntl(<ProfileHeader name="Satoshi" username="satoshi" showShareButton />)

        fireEvent.click(copyButton()!)

        await waitFor(() => expect(mockToastError).toHaveBeenCalledWith('Copy failed'))
        expect(mockToastInfo).not.toHaveBeenCalled()
    })

    it('shares the profile url and captures the click only on a successful share', () => {
        renderWithIntl(<ProfileHeader name="Satoshi" username="satoshi" showShareButton />)

        expect(mockShareButton).toHaveBeenCalledWith(expect.objectContaining({ url: `${ORIGIN}/satoshi` }))
        expect(posthog.capture).not.toHaveBeenCalledWith(ANALYTICS_EVENTS.REFERRAL_CTA_CLICKED, expect.anything())

        fireEvent.click(shareButton()!)

        expect(posthog.capture).toHaveBeenCalledWith(ANALYTICS_EVENTS.REFERRAL_CTA_CLICKED, {
            source: REFERRAL_SOURCES.PROFILE_HEADER,
            link_type: 'profile',
        })
    })

    // Chip (#2989): the url alone reads as a link, so the segment has to say
    // what activating it does — and keep saying the url, and the verified state.
    it('names the copy action, the url and the verified state in the accessible name', () => {
        renderWithIntl(<ProfileHeader name="Satoshi" username="satoshi" showShareButton isVerified />)

        expect(
            screen.getByRole('button', { name: /^Copy profile link peanut\.example\.org\/\s*satoshi Verified$/ })
        ).toBeInTheDocument()
    })

    // One border, three hit areas. Nesting the picker inside the share or the
    // copy button would be invalid html and would hand the avatar's tap away.
    it('keeps the avatar picker beside the copy and share buttons, not inside them', () => {
        const onChangeAvatar = jest.fn()
        renderWithIntl(
            <ProfileHeader name="Satoshi" username="satoshi" showShareButton onChangeAvatar={onChangeAvatar} />
        )

        const picker = screen.getByRole('button', { name: 'Change avatar' })
        expect(copyButton()!.contains(picker)).toBe(false)
        expect(shareButton()!.contains(picker)).toBe(false)

        fireEvent.click(picker)

        expect(onChangeAvatar).toHaveBeenCalledTimes(1)
        expect(mockCopy).not.toHaveBeenCalled()
        expect(posthog.capture).not.toHaveBeenCalledWith(ANALYTICS_EVENTS.REFERRAL_CTA_CLICKED, expect.anything())
    })
})
