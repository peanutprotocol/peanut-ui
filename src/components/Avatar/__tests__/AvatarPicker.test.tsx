import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import type { ComponentProps, ReactNode } from 'react'
import { renderWithIntl } from '@/test-utils/intl'
import { AvatarPicker } from '../AvatarPicker'

jest.mock('next/image', () => ({
    __esModule: true,
    default: ({ unoptimized, ...rest }: ComponentProps<'img'> & { unoptimized?: boolean }) => <img {...rest} />,
}))

// vaul needs a real layout; the picker's own logic is what is under test
jest.mock('@/components/Global/Drawer', () => {
    const Passthrough = ({ children }: { children?: ReactNode }) => <div>{children}</div>
    return {
        Drawer: ({ open, children }: { open: boolean; children?: ReactNode }) => (open ? <div>{children}</div> : null),
        DrawerContent: Passthrough,
        DrawerHeader: Passthrough,
        DrawerTitle: Passthrough,
        DrawerDescription: Passthrough,
    }
})

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
const A = 'Bug Whisperer · beetle'
const B = 'Bug Whisperer · shell'
const KEY_A = 'badge.BUG_WHISPERER.beetle'
const KEY_B = 'badge.BUG_WHISPERER.shell'

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
    it('lists one row of five basics and only the avatars of badges the user holds', () => {
        renderWithIntl(<AvatarPicker open onOpenChange={jest.fn()} />)

        expect(screen.getAllByRole('radio')).toHaveLength(8)
        // human labels, not keys: badge name + slug, or the slug alone
        expect(radio(A)).toBeInTheDocument()
        expect(screen.getByRole('radiogroup', { name: 'Basics' }).querySelectorAll('[role="radio"]')).toHaveLength(5)
        expect(screen.queryByRole('radio', { name: /Offramp/ })).not.toBeInTheDocument()
        expect(screen.getByRole('radiogroup', { name: 'From your badges' })).toBeInTheDocument()
    })

    it('tells a user with no badges where avatars come from', () => {
        mockUser.user.badges = []
        renderWithIntl(<AvatarPicker open onOpenChange={jest.fn()} />)

        expect(screen.getAllByRole('radio')).toHaveLength(5)
        expect(screen.getByText('Earn a badge and its avatars appear here.')).toBeInTheDocument()
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
        fireEvent.click(screen.getByRole('button', { name: 'Roll the dice' }))
        expect(radio(A)).toHaveAttribute('aria-checked', 'true')
    })

    it('the dice redeals the basics row and never changes the pick', () => {
        mockUser.user.avatarKey = 'basic.apple'
        const random = jest.spyOn(Math, 'random').mockReturnValue(0)
        renderWithIntl(<AvatarPicker open onOpenChange={jest.fn()} />)
        const rowOf = () =>
            Array.from(screen.getByRole('radiogroup', { name: 'Basics' }).querySelectorAll('[role="radio"]')).map(
                (el) => el.getAttribute('aria-label')
            )
        const before = rowOf()

        random.mockReturnValue(0.99)
        act(() => fireEvent.click(screen.getByRole('button', { name: 'Roll the dice' })))

        expect(rowOf()).not.toEqual(before)
        expect(rowOf()).toContain('apple')
        expect(radio('apple')).toHaveAttribute('aria-checked', 'true')
        expect(mockUpdateUserById).not.toHaveBeenCalled()
        random.mockRestore()
    })

    it('clears the pick back to the initial', () => {
        mockUser.user.avatarKey = 'basic.apple'
        renderWithIntl(<AvatarPicker open onOpenChange={jest.fn()} />)

        fireEvent.click(screen.getByRole('button', { name: 'Use my initial instead' }))

        expect(mockUpdateUserById).toHaveBeenCalledWith({ userId: 'u1', avatarKey: null })
    })

    it('closes on done', () => {
        const onOpenChange = jest.fn()
        renderWithIntl(<AvatarPicker open onOpenChange={onOpenChange} />)

        fireEvent.click(screen.getByRole('button', { name: 'Done' }))

        expect(onOpenChange).toHaveBeenCalledWith(false)
    })
})
