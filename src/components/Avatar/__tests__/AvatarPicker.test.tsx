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
        expect(radio('Bug Whisperer · beetle')).toBeInTheDocument()
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

        fireEvent.click(radio('Bug Whisperer · peek'))

        expect(radio('Bug Whisperer · peek')).toHaveAttribute('aria-checked', 'true')
        expect(mockUpdateUserById).toHaveBeenCalledWith({ userId: 'u1', avatarKey: 'badge.BUG_WHISPERER.peek' })
        await waitFor(() => expect(mockFetchUser).toHaveBeenCalled())
    })

    it('snaps back and says so when the save fails', async () => {
        mockUser.user.avatarKey = 'basic.sun'
        mockUpdateUserById.mockResolvedValue({ error: 'Avatar not unlocked' })
        renderWithIntl(<AvatarPicker open onOpenChange={jest.fn()} />)

        fireEvent.click(radio('Bug Whisperer · peek'))

        await waitFor(() => expect(radio('sun')).toHaveAttribute('aria-checked', 'true'))
        expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ type: 'error' }))
        // the server is the truth after a burst, failed or not
        expect(mockFetchUser).toHaveBeenCalledTimes(1)
    })

    // Chip (#2929): two taps whose responses arrive out of order
    const deferred = () => {
        let resolve!: (value: { data?: object; error?: string }) => void
        const promise = new Promise<{ data?: object; error?: string }>((r) => (resolve = r))
        return { promise, resolve }
    }
    const A = 'Bug Whisperer · beetle'
    const B = 'Bug Whisperer · shell'

    it('the last tap wins when the first response arrives after the second', async () => {
        const a = deferred()
        const b = deferred()
        mockUpdateUserById.mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise)
        // the server holds the last write; the refetch reads it back
        mockFetchUser.mockImplementation(async () => {
            mockUser.user.avatarKey = 'badge.BUG_WHISPERER.shell'
            return null
        })
        renderWithIntl(<AvatarPicker open onOpenChange={jest.fn()} />)

        fireEvent.click(radio(A))
        fireEvent.click(radio(B))
        await act(async () => b.resolve({ data: {} }))
        expect(radio(B)).toHaveAttribute('aria-checked', 'true')
        expect(mockFetchUser).not.toHaveBeenCalled()

        await act(async () => a.resolve({ data: {} }))

        await waitFor(() => expect(mockFetchUser).toHaveBeenCalledTimes(1))
        expect(radio(B)).toHaveAttribute('aria-checked', 'true')
        expect(radio(A)).toHaveAttribute('aria-checked', 'false')
    })

    it('a failed older request does not roll back a newer success', async () => {
        const a = deferred()
        const b = deferred()
        mockUpdateUserById.mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise)
        mockFetchUser.mockImplementation(async () => {
            mockUser.user.avatarKey = 'badge.BUG_WHISPERER.shell'
            return null
        })
        renderWithIntl(<AvatarPicker open onOpenChange={jest.fn()} />)

        fireEvent.click(radio(A))
        fireEvent.click(radio(B))
        await act(async () => b.resolve({ data: {} }))
        await act(async () => a.resolve({ error: 'Avatar not unlocked' }))

        await waitFor(() => expect(mockFetchUser).toHaveBeenCalledTimes(1))
        expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ type: 'error' }))
        expect(radio(B)).toHaveAttribute('aria-checked', 'true')
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
