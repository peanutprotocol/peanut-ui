import { fireEvent, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import posthog from 'posthog-js'
import ProfileHeader from '../ProfileHeader'
import { ANALYTICS_EVENTS, REFERRAL_SOURCES } from '@/constants/analytics.consts'
import { renderWithIntl } from '@/test-utils/intl'

let mockAuthUsername: string | undefined
const mockShareButton = jest.fn()
const mockCopyToClipboard = jest.fn()
const mockToast = { info: jest.fn(), error: jest.fn() }

jest.mock('@/context/authContext', () => ({
    useAuth: () => ({ user: mockAuthUsername ? { user: { username: mockAuthUsername } } : null }),
}))
jest.mock('@/hooks/useIdentityVerification', () => ({
    useIdentityVerification: () => ({ isVerified: false }),
}))
jest.mock('@/components/0_Bruddle/Toast', () => ({ useToast: () => mockToast }))
jest.mock('@/utils/clipboard.utils', () => ({
    copyTextToClipboard: (text: string) => mockCopyToClipboard(text),
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
jest.mock('@/components/Profile/AvatarWithBadge', () => ({
    __esModule: true,
    default: ({ name }: { name?: string }) => <div data-testid="counterparty-avatar">{name}</div>,
}))
jest.mock('@/components/Global/CopyToClipboard', () => ({ __esModule: true, default: () => null }))
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
    mockCopyToClipboard.mockResolvedValue(true)
})

afterAll(() => {
    Object.defineProperty(window, 'location', { value: originalLocation, writable: true })
})

// the pill's two hit areas: the handle copies the link, the icon shares it.
// The handle segment's name carries its sr-only action label and, without a
// name row, the verified state — so match the url rather than the whole name.
const copySegment = () => screen.queryByRole('button', { name: /peanut\.example\.org\/satoshi/ })
const shareSegment = () => screen.queryByRole('button', { name: 'Share' })
const avatarButton = () => screen.queryByRole('button', { name: 'Change avatar' })

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

            if (visible) expect(copySegment()).toBeInTheDocument()
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

    // With no full name the row used to fall back to the username, printing the
    // handle twice on a page whose pill already reads peanut.example.org/satoshi.
    it('drops the name row when the caller has no name to show, keeping the pill', () => {
        renderWithIntl(<ProfileHeader name="" username="satoshi" showShareButton />)

        expect(screen.queryByTestId('profile-name')).not.toBeInTheDocument()
        expect(copySegment()).toBeInTheDocument()
    })

    it('keeps the name row when a full name is set', () => {
        renderWithIntl(<ProfileHeader name="Satoshi Nakamoto" username="satoshi" showShareButton />)

        expect(screen.getByTestId('profile-name')).toHaveTextContent('Satoshi Nakamoto')
    })

    // One check per identity block: the pill carries the verified state only
    // when there is no name row, whose own check would otherwise repeat it.
    it('shows the verified check in the pill only while the name row is absent', () => {
        const { rerender } = renderWithIntl(<ProfileHeader name="" username="satoshi" isVerified showShareButton />)
        expect(screen.getByText('Verified')).toBeInTheDocument()

        rerender(<ProfileHeader name="Satoshi Nakamoto" username="satoshi" isVerified showShareButton />)
        expect(screen.queryByText('Verified')).not.toBeInTheDocument()
        expect(screen.getByTestId('profile-name')).toBeInTheDocument()
    })

    it('copies the profile url from the handle segment, toasts, and reports the copy', async () => {
        renderWithIntl(<ProfileHeader name="Satoshi" username="satoshi" showShareButton />)

        // the url alone reads as a link, so the segment names its action
        expect(screen.getByText('Copy profile link')).toBeInTheDocument()

        fireEvent.click(copySegment()!)

        await waitFor(() => expect(mockToast.info).toHaveBeenCalledWith('Link copied'))
        expect(mockCopyToClipboard).toHaveBeenCalledWith(`${ORIGIN}/satoshi`)
        expect(posthog.capture).toHaveBeenCalledWith(ANALYTICS_EVENTS.PROFILE_LINK_COPIED, {
            source: REFERRAL_SOURCES.PROFILE_HEADER,
            link_type: 'profile',
        })
    })

    // A clipboard the browser refused is not a copy: it says so and reports nothing.
    it('reports nothing when the copy fails', async () => {
        mockCopyToClipboard.mockResolvedValue(false)
        renderWithIntl(<ProfileHeader name="Satoshi" username="satoshi" showShareButton />)

        fireEvent.click(copySegment()!)

        await waitFor(() => expect(mockToast.error).toHaveBeenCalledWith('Copy failed'))
        expect(mockToast.info).not.toHaveBeenCalled()
        expect(posthog.capture).not.toHaveBeenCalledWith(ANALYTICS_EVENTS.PROFILE_LINK_COPIED, expect.anything())
    })

    it('shares the profile url from the icon segment, capturing the click only on a successful share', () => {
        renderWithIntl(<ProfileHeader name="Satoshi" username="satoshi" showShareButton />)

        expect(mockShareButton).toHaveBeenCalledWith(expect.objectContaining({ url: `${ORIGIN}/satoshi` }))
        expect(posthog.capture).not.toHaveBeenCalledWith(ANALYTICS_EVENTS.REFERRAL_CTA_CLICKED, expect.anything())

        fireEvent.click(shareSegment()!)

        expect(posthog.capture).toHaveBeenCalledWith(ANALYTICS_EVENTS.REFERRAL_CTA_CLICKED, {
            source: REFERRAL_SOURCES.PROFILE_HEADER,
            link_type: 'profile',
        })
        // sharing is not copying: the handle segment owns that event
        expect(posthog.capture).not.toHaveBeenCalledWith(ANALYTICS_EVENTS.PROFILE_LINK_COPIED, expect.anything())
    })

    // One pressed surface, two hit areas: the frame carries the press the
    // shipped one-button pill had, so neither segment tears off on its own. The
    // trailing share glyph draws no box — it reaches 44px through `after:`.
    it('presses as one pill and keeps the share icon a trailing glyph', () => {
        renderWithIntl(<ProfileHeader name="Satoshi" username="satoshi" showShareButton />)

        expect(copySegment()!.parentElement).toHaveClass('active:bg-action-primary')
        expect(copySegment()).not.toHaveClass('active:bg-action-primary')

        const { className } = mockShareButton.mock.calls.at(-1)![0] as { className: string }
        expect(className).toContain('h-auto')
        expect(className).toContain('after:-inset-3.5')

        // the handle is only as tall as the 40px pill, so it reaches the 44px
        // touch floor through the same `after:` trick — vertically only
        expect(copySegment()).toHaveClass('relative', 'after:absolute', 'after:inset-x-0', 'after:-inset-y-0.5')
    })

    // Two hit areas in one pill must not overlap, or the last few pixels of the
    // handle share instead of copying. jsdom has no layout, so the boundary tap
    // cannot be clicked — the invariant is arithmetic: the glyph grows to 44px
    // through `after:`, so the gap to the handle must cover that growth.
    it('keeps the share hit box out of the handle segment', () => {
        renderWithIntl(<ProfileHeader name="Satoshi" username="satoshi" showShareButton />)

        const { className } = mockShareButton.mock.calls.at(-1)![0] as { className: string }
        const grow = Number(className.match(/after:-inset-([\d.]+)/)![1])
        const gap = Number(className.match(/(?:^|\s)ml-([\d.]+)/)![1])
        expect(gap).toBeGreaterThanOrEqual(grow)
    })
})

describe('ProfileHeader avatar', () => {
    it('opens the picker from the avatar button', () => {
        const onChangeAvatar = jest.fn()
        renderWithIntl(
            <ProfileHeader name="Satoshi" username="satoshi" showShareButton onChangeAvatar={onChangeAvatar} />
        )

        // the DS Button, so the pressed state comes from `.btn-*`
        expect(avatarButton()).toHaveClass('btn')

        fireEvent.click(avatarButton()!)

        expect(onChangeAvatar).toHaveBeenCalledTimes(1)
    })

    // Option B (7 Sep): a column — the avatar sits above the pill, not inside it.
    it('stacks the avatar above the pill on the self profile', () => {
        renderWithIntl(<ProfileHeader name="" username="satoshi" showShareButton onChangeAvatar={jest.fn()} />)

        const avatar = avatarButton()!
        const copy = copySegment()!
        expect(avatar.contains(copy)).toBe(false)
        expect(avatar.compareDocumentPosition(copy) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    })

    // The counterparty branch is untouched by the self-profile rework: their
    // avatar, their name, and no pill — even when a picker callback is passed.
    it('keeps the counterparty branch on someone else profile', () => {
        renderWithIntl(<ProfileHeader name="Hal Finney" username="hal" showShareButton onChangeAvatar={jest.fn()} />)

        expect(screen.getByTestId('counterparty-avatar')).toHaveTextContent('Hal Finney')
        expect(screen.getByTestId('profile-name')).toHaveTextContent('Hal Finney')
        expect(screen.queryByRole('button')).not.toBeInTheDocument()
    })
})
