import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import type { ComponentProps, ReactNode } from 'react'
import { renderWithIntl } from '@/test-utils/intl'
import { AvatarPicker } from '../AvatarPicker'
import { readLetterAvatar, resetLetterAvatarCache } from '../avatar-letter.storage'

jest.mock('next/image', () => ({
    __esModule: true,
    default: ({ unoptimized, ...rest }: ComponentProps<'img'> & { unoptimized?: boolean }) => <img {...rest} />,
}))

// vaul needs a real layout; the picker's own logic is what is under test. The
// accessible title is captured rather than rendered, so a test can prove the
// sheet carries no title of its own while the drawer still gets one.
const mockDrawer: { accessibleTitle?: string } = {}
jest.mock('@/components/Global/Drawer', () => ({
    Drawer: ({
        open,
        onOpenChange,
        children,
    }: {
        open: boolean
        onOpenChange: (next: boolean) => void
        children?: ReactNode
    }) =>
        open ? (
            <div>
                {/* stands in for every way vaul dismisses the sheet */}
                <button onClick={() => onOpenChange(false)}>close drawer</button>
                {children}
            </div>
        ) : null,
    DrawerContent: ({ accessibleTitle, children }: { accessibleTitle?: string; children?: ReactNode }) => {
        mockDrawer.accessibleTitle = accessibleTitle
        return <div>{children}</div>
    },
}))

// the badge-earned toast's deep link, read straight off the URL by the picker
let mockBadgeParam: string | null = null
const mockSetBadgeParam = jest.fn()
jest.mock('nuqs', () => ({
    parseAsBoolean: { withDefault: () => ({}) },
    parseAsString: {},
    useQueryState: () => [mockBadgeParam, mockSetBadgeParam],
}))

const mockToast = jest.fn()
jest.mock('@/components/0_Bruddle/Toast', () => ({ useToast: () => ({ toast: mockToast }) }))

const mockUpdateUserById = jest.fn()
jest.mock('@/app/actions/users', () => ({ updateUserById: (...args: unknown[]) => mockUpdateUserById(...args) }))

const mockFetchUser = jest.fn()
// a cold load of the deep link renders the picker before authContext resolves
let mockHasUser = true
let mockUser: {
    user: { userId: string; username: string; avatarKey: string | null; badges: { code: string; name: string }[] }
}
jest.mock('@/context/authContext', () => ({
    useAuth: () => ({ user: mockHasUser ? mockUser : undefined, fetchUser: mockFetchUser }),
}))

const tiles = () => screen.getAllByRole('radio')
const tile = (name: RegExp) => screen.getByRole('radio', { name })
const die = () => screen.getByRole('button', { name: 'Roll the die' })

// Math.random is pinned to 0 for the suite, which deals a fixed hand: the
// initial, then apple, avocado, cactus, cloud, cube, donut and one earned
// beetle. The cast copy is what a tile prints, so the tiles are named by it.
const A = /Jackpot Cherry/
const B = /Watermelon Slice/
const KEY_A = 'basic.apple'
const KEY_B = 'basic.avocado'

// A server model: every POST is recorded in order and settled by hand, in any
// order; the last write the server COMMITS is what the refetch hands back.
type Settle = (result: { data?: object; error?: string }) => void
function fakeServer() {
    const posts: { key: string | null; resolve: Settle; reject: (e: Error) => void }[] = []
    let committed: string | null = mockUser.user.avatarKey
    mockUpdateUserById.mockImplementation(
        ({ avatarKey }: { avatarKey: string | null }) =>
            new Promise((resolve, reject) => posts.push({ key: avatarKey, resolve, reject }))
    )
    mockFetchUser.mockImplementation(async () => {
        mockUser.user.avatarKey = committed
        return null
    })
    return {
        posts,
        committed: () => committed,
        settle: (i: number, result: { data?: object; error?: string } = { data: {} }) =>
            act(async () => {
                if (!result.error) committed = posts[i].key
                posts[i].resolve(result)
            }),
        reject: (i: number) => act(async () => posts[i].reject(new Error('network'))),
    }
}

beforeEach(() => {
    jest.clearAllMocks()
    window.localStorage.clear()
    resetLetterAvatarCache()
    jest.spyOn(Math, 'random').mockReturnValue(0)
    mockBadgeParam = null
    mockHasUser = true
    mockUpdateUserById.mockResolvedValue({ data: {} })
    mockFetchUser.mockResolvedValue(null)
    mockUser = {
        user: {
            userId: 'u1',
            username: 'satoshi',
            avatarKey: null,
            badges: [{ code: 'BUG_WHISPERER', name: 'Bug Whisperer' }],
        },
    }
})

afterEach(() => jest.restoreAllMocks())

describe('AvatarPicker', () => {
    it('deals a hand of eight tiles and the die', () => {
        renderWithIntl(<AvatarPicker open onOpenChange={jest.fn()} />)

        expect(tiles()).toHaveLength(8)
        expect(die()).toBeInTheDocument()
    })

    it('is the hand and nothing else: no title, no description, no header', () => {
        renderWithIntl(<AvatarPicker open onOpenChange={jest.fn()} />)

        // the drawer still names itself for assistive tech; the sheet does not
        expect(mockDrawer.accessibleTitle).toBe('Your avatar')
        expect(screen.queryByText('Your avatar')).not.toBeInTheDocument()
        expect(screen.queryByText(/Pick one, or roll the dice/)).not.toBeInTheDocument()
        expect(screen.queryByTestId('drawer-header')).not.toBeInTheDocument()
        expect(screen.queryByRole('heading')).not.toBeInTheDocument()
    })

    it('names and lines every tile', () => {
        renderWithIntl(<AvatarPicker open onOpenChange={jest.fn()} />)

        expect(tile(A)).toHaveTextContent('Two short of rich')
        expect(tile(/Grumpy Raincloud/)).toHaveTextContent('Complains, still comes')
        for (const el of tiles()) expect(el.textContent?.trim()).not.toBe('')
    })

    it('opens on the initial, and saves it as a letter pick rather than a cleared key', async () => {
        mockUser.user.avatarKey = KEY_A
        renderWithIntl(<AvatarPicker open onOpenChange={jest.fn()} />)

        const initial = tiles()[0]
        expect(initial).toHaveTextContent('Just S')
        expect(initial).toHaveTextContent('Your initial')

        fireEvent.click(initial)

        expect(mockUpdateUserById).toHaveBeenCalledWith({ userId: 'u1', avatarKey: 'letter.s' })
        expect(initial).toHaveAttribute('aria-checked', 'true')
        await waitFor(() => expect(mockFetchUser).toHaveBeenCalledTimes(1))
    })

    it('reads the initial as checked while nothing is picked', () => {
        renderWithIntl(<AvatarPicker open onOpenChange={jest.fn()} />)

        expect(tiles()[0]).toHaveAttribute('aria-checked', 'true')
    })

    // slot 1 is the user's OWN letter; someone wearing another one is not
    // claiming an initial, so no tile claims to be it either
    it('leaves nothing checked when the pick is a letter that is not the initial', () => {
        mockUser.user.avatarKey = 'letter.k'
        renderWithIntl(<AvatarPicker open onOpenChange={jest.fn()} />)

        expect(tiles().filter((el) => el.getAttribute('aria-checked') === 'true')).toHaveLength(0)
    })

    it('deals an earned avatar, tagged, to a user who holds a badge — and none to one who does not', () => {
        const { unmount } = renderWithIntl(<AvatarPicker open onOpenChange={jest.fn()} />)

        const earned = tiles().filter((el) => el.textContent?.includes('Earned'))
        expect(earned.length).toBeGreaterThan(0)
        // named after its art, lined with the badge that unlocked it
        expect(earned[0]).toHaveTextContent('Beetle')
        expect(earned[0]).toHaveTextContent('Bug Whisperer')

        unmount()
        mockUser.user.badges = []
        renderWithIntl(<AvatarPicker open onOpenChange={jest.fn()} />)

        expect(screen.queryByText('Earned')).not.toBeInTheDocument()
    })

    // a radiogroup may only hold radios, so the die sits beside the tiles in
    // the same grid rather than inside the group
    it('puts the eight tiles in the radiogroup and the die outside it', () => {
        renderWithIntl(<AvatarPicker open onOpenChange={jest.fn()} />)

        const group = screen.getByRole('radiogroup', { name: 'Your avatar' })
        expect(Array.from(group.children).map((el) => el.getAttribute('role'))).toEqual(Array(8).fill('radio'))
        expect(group.contains(die())).toBe(false)
    })

    it('roves the hand with the arrow keys', () => {
        renderWithIntl(<AvatarPicker open onOpenChange={jest.fn()} />)
        const hand = tiles()
        hand[0].focus()

        fireEvent.keyDown(screen.getByRole('radiogroup'), { key: 'ArrowRight' })

        expect(hand[1]).toHaveFocus()
    })

    it('deals the badge the deep link names', () => {
        mockBadgeParam = 'OG_2025_10_12'
        mockUser.user.badges = [
            { code: 'BUG_WHISPERER', name: 'Bug Whisperer' },
            { code: 'OG_2025_10_12', name: 'OG' },
        ]
        renderWithIntl(<AvatarPicker open onOpenChange={jest.fn()} />)

        expect(tile(/Coin/)).toHaveTextContent('OG')
    })

    it('deals again when a cold-load deep link resolves its user', () => {
        mockHasUser = false
        mockBadgeParam = 'OG_2025_10_12'
        mockUser.user.badges = [
            { code: 'BUG_WHISPERER', name: 'Bug Whisperer' },
            { code: 'OG_2025_10_12', name: 'OG' },
        ]
        const { rerender } = renderWithIntl(<AvatarPicker open onOpenChange={jest.fn()} />)

        // nothing to deal from yet: eight tiles, but no badge and no initial
        expect(tiles()).toHaveLength(8)
        expect(screen.queryByText('Earned')).not.toBeInTheDocument()
        expect(screen.queryByText('Just S')).not.toBeInTheDocument()

        mockHasUser = true
        rerender(<AvatarPicker open onOpenChange={jest.fn()} />)

        // no tap needed: the hand is dealt again the moment the user lands
        expect(tile(/Coin/)).toHaveTextContent('OG')
        expect(tiles()[0]).toHaveTextContent('Just S')
    })

    // the deep link is spent by the hand it dealt; left in the URL it would
    // stack the same badge into every later open
    it('clears the badge deep link when the sheet closes', () => {
        mockBadgeParam = 'OG_2025_10_12'
        const onOpenChange = jest.fn()
        renderWithIntl(<AvatarPicker open onOpenChange={onOpenChange} />)

        fireEvent.click(screen.getByRole('button', { name: 'close drawer' }))

        expect(mockSetBadgeParam).toHaveBeenCalledWith(null)
        expect(onOpenChange).toHaveBeenCalledWith(false)
    })

    it('leaves the URL alone when there was no deep link', () => {
        renderWithIntl(<AvatarPicker open onOpenChange={jest.fn()} />)

        fireEvent.click(screen.getByRole('button', { name: 'close drawer' }))

        expect(mockSetBadgeParam).not.toHaveBeenCalled()
    })

    it('keeps the current pick in the hand, checked', () => {
        mockUser.user.avatarKey = 'basic.cactus'
        renderWithIntl(<AvatarPicker open onOpenChange={jest.fn()} />)

        expect(tile(/Bold Chili/)).toHaveAttribute('aria-checked', 'true')
        expect(tiles()[0]).toHaveAttribute('aria-checked', 'false')
    })

    it('deals a new hand on the die and never changes the pick', () => {
        mockUser.user.avatarKey = 'basic.cactus'
        renderWithIntl(<AvatarPicker open onOpenChange={jest.fn()} />)
        const handOf = () => tiles().map((el) => el.textContent)
        const before = handOf()

        jest.spyOn(Math, 'random').mockReturnValue(0.99)
        act(() => fireEvent.click(die()))

        expect(handOf()).not.toEqual(before)
        expect(tile(/Bold Chili/)).toHaveAttribute('aria-checked', 'true')
        expect(mockUpdateUserById).not.toHaveBeenCalled()
    })

    it('saves a tap at once and refreshes the user', async () => {
        renderWithIntl(<AvatarPicker open onOpenChange={jest.fn()} />)

        fireEvent.click(tile(B))

        expect(tile(B)).toHaveAttribute('aria-checked', 'true')
        expect(mockUpdateUserById).toHaveBeenCalledWith({ userId: 'u1', avatarKey: KEY_B })
        await waitFor(() => expect(mockFetchUser).toHaveBeenCalledTimes(1))
    })

    it('snaps back and says so when the save fails', async () => {
        mockUser.user.avatarKey = KEY_A
        mockUpdateUserById.mockResolvedValue({ error: 'Avatar not unlocked' })
        renderWithIntl(<AvatarPicker open onOpenChange={jest.fn()} />)

        fireEvent.click(tile(B))

        await waitFor(() => expect(tile(A)).toHaveAttribute('aria-checked', 'true'))
        expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ type: 'error' }))
        // the server is the truth after a burst, failed or not
        expect(mockFetchUser).toHaveBeenCalledTimes(1)
    })

    // Chip (#2929): saves are serialized, so the server can never commit an
    // older key last, whatever order the responses come back in.
    it('sends one save at a time, always the latest tap next, and the server ends on the last tap', async () => {
        const server = fakeServer()
        renderWithIntl(<AvatarPicker open onOpenChange={jest.fn()} />)

        fireEvent.click(tile(A))
        fireEvent.click(tile(B))

        // (a) the second POST is not sent before the first settles
        expect(server.posts.map((p) => p.key)).toEqual([KEY_A])
        expect(tile(B)).toHaveAttribute('aria-checked', 'true')

        await server.settle(0)
        expect(server.posts.map((p) => p.key)).toEqual([KEY_A, KEY_B])
        expect(mockFetchUser).not.toHaveBeenCalled()

        await server.settle(1)

        // (b) the server's last write is the last tap, refetched once
        await waitFor(() => expect(mockFetchUser).toHaveBeenCalledTimes(1))
        expect(server.committed()).toBe(KEY_B)
        expect(tile(B)).toHaveAttribute('aria-checked', 'true')
        expect(tile(A)).toHaveAttribute('aria-checked', 'false')
    })

    it('a tap during the closing refetch is sent, not dropped', async () => {
        const server = fakeServer()
        // hold the refetch open so a tap can land while it is in flight
        let releaseFetch: () => void = () => {}
        mockFetchUser.mockImplementation(
            () =>
                new Promise<null>((resolve) => {
                    releaseFetch = () => {
                        mockUser.user.avatarKey = server.committed()
                        resolve(null)
                    }
                })
        )
        renderWithIntl(<AvatarPicker open onOpenChange={jest.fn()} />)

        fireEvent.click(tile(A))
        await server.settle(0)
        await waitFor(() => expect(mockFetchUser).toHaveBeenCalledTimes(1))

        fireEvent.click(tile(B))
        expect(server.posts.map((p) => p.key)).toEqual([KEY_A])
        await act(async () => releaseFetch())

        // the queued tap drains after the refetch: B is posted, committed, refetched
        await waitFor(() => expect(server.posts.map((p) => p.key)).toEqual([KEY_A, KEY_B]))
        await server.settle(1)
        await waitFor(() => expect(mockFetchUser).toHaveBeenCalledTimes(2))
        await act(async () => releaseFetch())
        expect(server.committed()).toBe(KEY_B)
        expect(tile(B)).toHaveAttribute('aria-checked', 'true')
    })

    it('a rejected first save still lets the second go through and clears pending', async () => {
        const server = fakeServer()
        renderWithIntl(<AvatarPicker open onOpenChange={jest.fn()} />)

        fireEvent.click(tile(A))
        fireEvent.click(tile(B))
        await server.reject(0)

        expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ type: 'error' }))
        expect(server.posts.map((p) => p.key)).toEqual([KEY_A, KEY_B])

        await server.settle(1)

        await waitFor(() => expect(mockFetchUser).toHaveBeenCalledTimes(1))
        expect(server.committed()).toBe(KEY_B)
        expect(tile(B)).toHaveAttribute('aria-checked', 'true')
        // pending is cleared: a later refetch that says otherwise wins
        mockUser.user.avatarKey = KEY_A
        act(() => fireEvent.click(die()))
        expect(tile(A)).toHaveAttribute('aria-checked', 'true')
    })

    it('keeps a letter this API build still rejects, on the device, without an error toast', async () => {
        const server = fakeServer()
        renderWithIntl(<AvatarPicker open onOpenChange={jest.fn()} />)

        fireEvent.click(tiles()[0])
        await server.settle(0, { error: 'body/avatarKey must match pattern' })

        // the pick survives the rejection and the user is not told off for it
        await waitFor(() => expect(readLetterAvatar('u1')?.key).toBe('letter.s'))
        expect(mockToast).not.toHaveBeenCalled()
        await waitFor(() => expect(tiles()[0]).toHaveAttribute('aria-checked', 'true'))
    })

    it('still reports a rejected sticker — those have no device-local fallback', async () => {
        const server = fakeServer()
        renderWithIntl(<AvatarPicker open onOpenChange={jest.fn()} />)

        fireEvent.click(tile(A))
        await server.settle(0, { error: 'Avatar not unlocked' })

        expect(mockToast).toHaveBeenCalledWith({ type: 'error', message: 'Could not save your avatar. Try again.' })
        expect(readLetterAvatar('u1')).toBeNull()
    })

    it('restores the saved badge to the hand when a save fails after a roll', async () => {
        mockUser.user.avatarKey = 'badge.BUG_WHISPERER.shell'
        const server = fakeServer()
        renderWithIntl(<AvatarPicker open onOpenChange={jest.fn()} />)

        fireEvent.click(tile(A))
        fireEvent.click(die())
        expect(screen.queryByRole('radio', { name: /Shell/ })).not.toBeInTheDocument()

        await server.settle(0, { error: 'Could not save' })

        await waitFor(() => expect(tile(/Shell/)).toHaveAttribute('aria-checked', 'true'))
        expect(tiles()).toHaveLength(8)
        expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ type: 'error' }))
    })

    it('keeps the dealt hand when a save succeeds after a roll', async () => {
        mockUser.user.avatarKey = 'badge.BUG_WHISPERER.shell'
        const server = fakeServer()
        renderWithIntl(<AvatarPicker open onOpenChange={jest.fn()} />)

        fireEvent.click(tile(A))
        fireEvent.click(die())
        const hand = tiles().map((el) => el.textContent)
        await server.settle(0)

        await waitFor(() => expect(mockFetchUser).toHaveBeenCalledTimes(1))
        expect(tile(A)).toHaveAttribute('aria-checked', 'true')
        expect(tiles().map((el) => el.textContent)).toEqual(hand)
    })

    it('a server write that lands drops the mirror, so the durable copy wins', async () => {
        const server = fakeServer()
        renderWithIntl(<AvatarPicker open onOpenChange={jest.fn()} />)

        fireEvent.click(tiles()[0])
        await server.settle(0, { error: 'body/avatarKey must match pattern' })
        await waitFor(() => expect(readLetterAvatar('u1')?.key).toBe('letter.s'))

        fireEvent.click(tile(A))
        await server.settle(1)

        await waitFor(() => expect(readLetterAvatar('u1')).toBeNull())
        expect(server.committed()).toBe(KEY_A)
    })
})
