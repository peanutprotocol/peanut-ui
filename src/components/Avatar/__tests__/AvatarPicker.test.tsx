import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import type { ComponentProps, ReactNode } from 'react'
import { renderWithIntl } from '@/test-utils/intl'
import { AvatarPicker } from '../AvatarPicker'
import { badgeAvatarKeys } from '../avatar.utils'

jest.mock('next/image', () => ({
    __esModule: true,
    default: ({ unoptimized, ...rest }: ComponentProps<'img'> & { unoptimized?: boolean }) => <img {...rest} />,
}))

// vaul needs a real layout; the picker's own logic is what is under test
jest.mock('@/components/Global/Drawer', () => ({
    Drawer: ({ open, children }: { open: boolean; children?: ReactNode }) => (open ? <div>{children}</div> : null),
    DrawerContent: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}))

// the deal is random and has its own suite (avatar.utils.test); here the hand
// is fixed so every test knows what is on the table
const mockDealHand = jest.fn()
jest.mock('../avatar.utils', () => ({
    ...jest.requireActual('../avatar.utils'),
    dealHand: (...args: unknown[]) => mockDealHand(...args),
}))

const mockToast = jest.fn()
jest.mock('@/components/0_Bruddle/Toast', () => ({ useToast: () => ({ toast: mockToast }) }))

const mockUpdateUserById = jest.fn()
jest.mock('@/app/actions/users', () => ({ updateUserById: (...args: unknown[]) => mockUpdateUserById(...args) }))

const mockFetchUser = jest.fn()
let mockUser: {
    user: { userId: string; username: string; avatarKey: string | null; badges: { code: string; name: string }[] }
}
jest.mock('@/context/authContext', () => ({ useAuth: () => ({ user: mockUser, fetchUser: mockFetchUser }) }))

const radio = (key: string) => screen.getByRole('radio', { name: key })
const handOf = () => screen.getAllByRole('radio').map((el) => el.getAttribute('aria-label'))
const rollDie = () => screen.getByRole('button', { name: 'Roll the die' })
const A = 'Bug Whisperer · beetle'
const B = 'Bug Whisperer · shell'
const KEY_A = 'badge.BUG_WHISPERER.beetle'
const KEY_B = 'badge.BUG_WHISPERER.shell'
const KEY_C = 'badge.BUG_WHISPERER.peek'
const UNLOCKED = badgeAvatarKeys(['BUG_WHISPERER'])
const HAND = [null, KEY_C, KEY_B, KEY_A, 'basic.sun', 'basic.star', 'basic.planet', 'basic.mushroom']
const HAND_WITH_APPLE = [null, KEY_C, 'basic.apple', KEY_B, KEY_A, 'basic.sun', 'basic.star', 'basic.planet']

// A server model: every POST is recorded in order and settled by hand, in any
// order; the last write the server COMMITS is what the refetch hands back.
type Settle = (result: { data?: object; error?: string }) => void
function fakeServer() {
    const posts: { key: string | null; resolve: Settle; reject: (e: Error) => void }[] = []
    let committed: string | null = null
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
    mockDealHand.mockReturnValue(HAND)
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

describe('AvatarPicker', () => {
    it('deals one hand of eight behind the initial, earned avatars marked, the die ninth', () => {
        renderWithIntl(<AvatarPicker open onOpenChange={jest.fn()} />)

        expect(mockDealHand).toHaveBeenCalledWith(null, UNLOCKED, { prefer: undefined })
        const group = screen.getByRole('radiogroup', { name: 'Your avatar' })
        expect(group.querySelectorAll('[role="radio"]')).toHaveLength(8)
        expect(handOf()[0]).toBe('Your initial')
        expect(radio('Your initial')).toHaveAttribute('aria-checked', 'true')
        // the three Bug Whisperer avatars, each tagged
        expect(screen.getAllByText('Earned')).toHaveLength(3)
        expect(radio(A)).toBeInTheDocument()
        // basics carry their cast name, not their slug
        expect(radio('Bossy Goose')).toBeInTheDocument()
        expect(rollDie()).toBeInTheDocument()
        // no title, no description, no button besides the die (tiles are radios)
        expect(screen.getAllByRole('button')).toHaveLength(1)
    })

    it('deals nothing earned to a user with no badges', () => {
        mockUser.user.badges = []
        mockDealHand.mockReturnValue([
            null,
            ...['sun', 'star', 'planet', 'moon', 'leaf', 'gem', 'frog'].map((s) => `basic.${s}`),
        ])
        renderWithIntl(<AvatarPicker open onOpenChange={jest.fn()} />)

        expect(mockDealHand).toHaveBeenCalledWith(null, [], { prefer: undefined })
        expect(screen.getAllByRole('radio')).toHaveLength(8)
        expect(screen.queryByText('Earned')).not.toBeInTheDocument()
    })

    it('deals the first hand from the badge the deep link names', () => {
        renderWithIntl(<AvatarPicker open onOpenChange={jest.fn()} prefer="BUG_WHISPERER" />)

        expect(mockDealHand).toHaveBeenCalledWith(null, UNLOCKED, { prefer: 'BUG_WHISPERER' })
    })

    it('saves a tap at once and refreshes the user', async () => {
        renderWithIntl(<AvatarPicker open onOpenChange={jest.fn()} />)

        fireEvent.click(radio(B))

        expect(radio(B)).toHaveAttribute('aria-checked', 'true')
        expect(mockUpdateUserById).toHaveBeenCalledWith({ userId: 'u1', avatarKey: KEY_B })
        await waitFor(() => expect(mockFetchUser).toHaveBeenCalledTimes(1))
    })

    it('snaps back and says so when the save fails', async () => {
        mockUser.user.avatarKey = KEY_A
        mockUpdateUserById.mockResolvedValue({ error: 'Avatar not unlocked' })
        renderWithIntl(<AvatarPicker open onOpenChange={jest.fn()} />)

        fireEvent.click(radio(B))

        await waitFor(() => expect(radio(A)).toHaveAttribute('aria-checked', 'true'))
        expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ type: 'error' }))
        // the server is the truth after a burst, failed or not
        expect(mockFetchUser).toHaveBeenCalledTimes(1)
    })

    // Chip (#2929): saves are serialized, so the server can never commit an
    // older key last, whatever order the responses come back in.
    it('sends one save at a time, always the latest tap next, and the server ends on the last tap', async () => {
        const server = fakeServer()
        renderWithIntl(<AvatarPicker open onOpenChange={jest.fn()} />)

        fireEvent.click(radio(A))
        fireEvent.click(radio(B))

        // (a) the second POST is not sent before the first settles
        expect(server.posts.map((p) => p.key)).toEqual([KEY_A])
        expect(radio(B)).toHaveAttribute('aria-checked', 'true')

        await server.settle(0)
        expect(server.posts.map((p) => p.key)).toEqual([KEY_A, KEY_B])
        expect(mockFetchUser).not.toHaveBeenCalled()

        await server.settle(1)

        // (b) the server's last write is the last tap, refetched once
        await waitFor(() => expect(mockFetchUser).toHaveBeenCalledTimes(1))
        expect(server.committed()).toBe(KEY_B)
        expect(radio(B)).toHaveAttribute('aria-checked', 'true')
        expect(radio(A)).toHaveAttribute('aria-checked', 'false')
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

        fireEvent.click(radio(A))
        await server.settle(0)
        await waitFor(() => expect(mockFetchUser).toHaveBeenCalledTimes(1))

        fireEvent.click(radio(B))
        expect(server.posts.map((p) => p.key)).toEqual([KEY_A])
        await act(async () => releaseFetch())

        // the queued tap drains after the refetch: B is posted, committed, refetched
        await waitFor(() => expect(server.posts.map((p) => p.key)).toEqual([KEY_A, KEY_B]))
        await server.settle(1)
        await waitFor(() => expect(mockFetchUser).toHaveBeenCalledTimes(2))
        await act(async () => releaseFetch())
        expect(server.committed()).toBe(KEY_B)
        expect(radio(B)).toHaveAttribute('aria-checked', 'true')
    })

    // Chip (#2989): the pill already shows the new avatar while the save
    // drains, so a close/reopen in that window must deal from the pending pick
    // — dealing from `saved` can drop it and leave no tile checked.
    it('deals from the pending pick when reopened during an in-flight save', async () => {
        const server = fakeServer()
        const { rerender } = renderWithIntl(<AvatarPicker open onOpenChange={jest.fn()} />)

        fireEvent.click(radio(B))
        expect(server.posts.map((post) => post.key)).toEqual([KEY_B])

        rerender(<AvatarPicker open={false} onOpenChange={jest.fn()} />)
        rerender(<AvatarPicker open onOpenChange={jest.fn()} />)

        expect(mockDealHand).toHaveBeenLastCalledWith(KEY_B, UNLOCKED, { prefer: undefined })
        expect(radio(B)).toHaveAttribute('aria-checked', 'true')

        await server.settle(0)
        await waitFor(() => expect(mockFetchUser).toHaveBeenCalledTimes(1))
        expect(server.committed()).toBe(KEY_B)
        expect(radio(B)).toHaveAttribute('aria-checked', 'true')
    })

    it('a rejected first save still lets the second go through and clears pending', async () => {
        const server = fakeServer()
        renderWithIntl(<AvatarPicker open onOpenChange={jest.fn()} />)

        fireEvent.click(radio(A))
        fireEvent.click(radio(B))
        await server.reject(0)

        expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ type: 'error' }))
        expect(server.posts.map((p) => p.key)).toEqual([KEY_A, KEY_B])

        await server.settle(1)

        await waitFor(() => expect(mockFetchUser).toHaveBeenCalledTimes(1))
        expect(server.committed()).toBe(KEY_B)
        expect(radio(B)).toHaveAttribute('aria-checked', 'true')
        // pending is cleared: a later refetch that says otherwise wins
        mockUser.user.avatarKey = KEY_A
        fireEvent.click(rollDie())
        expect(radio(A)).toHaveAttribute('aria-checked', 'true')
    })

    it('the die deals a new hand and never changes the pick or the initial', () => {
        mockUser.user.avatarKey = 'basic.apple'
        const rolled = [
            null,
            'basic.apple',
            KEY_A,
            'basic.avocado',
            'basic.cactus',
            'basic.cloud',
            'basic.cube',
            'basic.donut',
        ]
        mockDealHand.mockReturnValueOnce(HAND_WITH_APPLE).mockReturnValueOnce(rolled)
        renderWithIntl(<AvatarPicker open onOpenChange={jest.fn()} />)
        const before = handOf()
        expect(radio('Jackpot Cherry')).toHaveAttribute('aria-checked', 'true')

        act(() => fireEvent.click(rollDie()))

        // the roll deals from the pick, with no preference
        expect(mockDealHand).toHaveBeenLastCalledWith('basic.apple', UNLOCKED)
        expect(handOf()).not.toEqual(before)
        expect(handOf()[0]).toBe('Your initial')
        expect(radio('Jackpot Cherry')).toHaveAttribute('aria-checked', 'true')
        expect(mockUpdateUserById).not.toHaveBeenCalled()
    })

    it('tapping the initial clears the pick', () => {
        mockUser.user.avatarKey = 'basic.apple'
        mockDealHand.mockReturnValue(HAND_WITH_APPLE)
        renderWithIntl(<AvatarPicker open onOpenChange={jest.fn()} />)

        fireEvent.click(radio('Your initial'))

        expect(radio('Your initial')).toHaveAttribute('aria-checked', 'true')
        expect(mockUpdateUserById).toHaveBeenCalledWith({ userId: 'u1', avatarKey: null })
    })
})
