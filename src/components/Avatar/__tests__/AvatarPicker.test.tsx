import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import type { ComponentProps, ReactNode } from 'react'
import { renderWithIntl } from '@/test-utils/intl'
import { AvatarPicker } from '../AvatarPicker'
import { avatarPool } from '../avatar.utils'

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
let mockUser: { user: { userId: string; username: string; avatarKey: string | null; badges: { code: string }[] } }
jest.mock('@/context/authContext', () => ({ useAuth: () => ({ user: mockUser, fetchUser: mockFetchUser }) }))

const radio = (key: string) => screen.getByRole('radio', { name: key })

beforeEach(() => {
    jest.clearAllMocks()
    mockUpdateUserById.mockResolvedValue({ data: {} })
    mockFetchUser.mockResolvedValue(null)
    mockUser = { user: { userId: 'u1', username: 'satoshi', avatarKey: null, badges: [{ code: 'BUG_WHISPERER' }] } }
})

describe('AvatarPicker', () => {
    it('lists the basics and only the avatars of badges the user holds', () => {
        renderWithIntl(<AvatarPicker open onOpenChange={jest.fn()} />)

        expect(screen.getAllByRole('radio')).toHaveLength(23)
        expect(radio('badge.BUG_WHISPERER.beetle')).toBeInTheDocument()
        expect(screen.queryByRole('radio', { name: 'badge.OFFRAMP_USER.bolt' })).not.toBeInTheDocument()
        expect(screen.getByRole('radiogroup', { name: 'From your badges' })).toBeInTheDocument()
    })

    it('tells a user with no badges where avatars come from', () => {
        mockUser.user.badges = []
        renderWithIntl(<AvatarPicker open onOpenChange={jest.fn()} />)

        expect(screen.getAllByRole('radio')).toHaveLength(20)
        expect(screen.getByText('Earn a badge and its avatars appear here.')).toBeInTheDocument()
    })

    it('saves a tap at once and refreshes the user', async () => {
        renderWithIntl(<AvatarPicker open onOpenChange={jest.fn()} />)

        fireEvent.click(radio('badge.BUG_WHISPERER.peek'))

        expect(radio('badge.BUG_WHISPERER.peek')).toHaveAttribute('aria-checked', 'true')
        expect(mockUpdateUserById).toHaveBeenCalledWith({ userId: 'u1', avatarKey: 'badge.BUG_WHISPERER.peek' })
        await waitFor(() => expect(mockFetchUser).toHaveBeenCalled())
    })

    it('snaps back and says so when the save fails', async () => {
        mockUser.user.avatarKey = 'basic.sun'
        mockUpdateUserById.mockResolvedValue({ error: 'Avatar not unlocked' })
        renderWithIntl(<AvatarPicker open onOpenChange={jest.fn()} />)

        fireEvent.click(radio('basic.apple'))

        await waitFor(() => expect(radio('basic.sun')).toHaveAttribute('aria-checked', 'true'))
        expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ type: 'error' }))
        expect(mockFetchUser).not.toHaveBeenCalled()
    })

    it('rolls the die inside the unlocked pool and never lands on the current pick', () => {
        mockUser.user.avatarKey = 'basic.apple'
        jest.spyOn(Math, 'random').mockReturnValue(0)
        renderWithIntl(<AvatarPicker open onOpenChange={jest.fn()} />)

        act(() => fireEvent.click(screen.getByRole('button', { name: 'Roll the die' })))

        const key = mockUpdateUserById.mock.calls[0][0].avatarKey as string
        expect(avatarPool(['BUG_WHISPERER'])).toContain(key)
        expect(key).not.toBe('basic.apple')
        ;(Math.random as jest.Mock).mockRestore()
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
