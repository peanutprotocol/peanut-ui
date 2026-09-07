import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import type { ComponentProps, ReactNode } from 'react'
import { renderWithIntl } from '@/test-utils/intl'
import { AvatarPicker } from '../AvatarPicker'
import { readLetterAvatar, resetLetterAvatarCache } from '../avatar-letter.storage'

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

beforeEach(() => {
    jest.clearAllMocks()
    window.localStorage.clear()
    resetLetterAvatarCache()
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
jest.mock('../DiceRoll', () => ({
    DiceRoll: ({ onComplete }: { onComplete: () => void }) => <button onClick={onComplete}>Finish roll</button>,
}))
const roll = () => {
    fireEvent.click(screen.getByRole('button', { name: 'Roll the dice' }))
    fireEvent.click(screen.getByRole('button', { name: 'Finish roll' }))
}

it('starts with the username initial selected at the left of a single row', () => {
    renderWithIntl(<AvatarPicker open onOpenChange={jest.fn()} />)
    const letters = screen.getAllByRole('radio')
    expect(letters).toHaveLength(26)
    expect(letters[0]).toHaveAttribute('aria-label', 'S')
    expect(letters[0]).toHaveAttribute('aria-checked', 'true')
    expect(mockUpdateUserById).not.toHaveBeenCalled()
})
it('stages a letter and saves only on confirmation', async () => {
    const close = jest.fn()
    renderWithIntl(<AvatarPicker open onOpenChange={close} />)
    fireEvent.click(screen.getByRole('radio', { name: 'K' }))
    expect(mockUpdateUserById).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Use the Initial' }))
    await waitFor(() => expect(close).toHaveBeenCalledWith(false))
    expect(mockUpdateUserById).toHaveBeenCalledWith({ userId: 'u1', avatarKey: 'letter.k' })
    expect(mockFetchUser).toHaveBeenCalledTimes(1)
})
it('deals a square of distinct non-letter art after animation and requires selection', async () => {
    const close = jest.fn()
    renderWithIntl(<AvatarPicker open onOpenChange={close} />)
    roll()
    const options = screen.getAllByRole('radio')
    expect([9, 16, 25]).toContain(options.length)
    const images = options.map((el) => el.querySelector('img')!.getAttribute('src'))
    expect(new Set(images).size).toBe(images.length)
    expect(images.every((src) => !src?.includes('/letter/'))).toBe(true)
    const use = screen.getByRole('button', { name: 'Use the Avatar' })
    expect(use).toBeDisabled()
    fireEvent.click(options[0])
    expect(use).toBeEnabled()
    expect(mockUpdateUserById).not.toHaveBeenCalled()
    fireEvent.click(use)
    await waitFor(() => expect(close).toHaveBeenCalledWith(false))
})
it('reroll clears selection without saving', () => {
    renderWithIntl(<AvatarPicker open onOpenChange={jest.fn()} />)
    roll()
    fireEvent.click(screen.getAllByRole('radio')[0])
    roll()
    expect(screen.getByRole('button', { name: 'Use the Avatar' })).toBeDisabled()
    expect(mockUpdateUserById).not.toHaveBeenCalled()
})
it('keeps rejected letters in the existing device mirror', async () => {
    mockUpdateUserById.mockResolvedValue({ error: 'unsupported letter' })
    renderWithIntl(<AvatarPicker open onOpenChange={jest.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Use the Initial' }))
    await waitFor(() => expect(readLetterAvatar('u1')?.key).toBe('letter.s'))
    expect(mockToast).not.toHaveBeenCalled()
})
it('reports a rejected avatar and keeps the drawer open for retry', async () => {
    mockUpdateUserById.mockRejectedValue(new Error('offline'))
    const close = jest.fn()
    renderWithIntl(<AvatarPicker open onOpenChange={close} />)
    roll()
    fireEvent.click(screen.getAllByRole('radio')[0])
    fireEvent.click(screen.getByRole('button', { name: 'Use the Avatar' }))
    await waitFor(() => expect(mockToast).toHaveBeenCalled())
    expect(close).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Use the Avatar' })).toBeEnabled()
})
it('prevents duplicate confirmation requests', async () => {
    let resolve!: (value: object) => void
    mockUpdateUserById.mockReturnValue(
        new Promise((r) => {
            resolve = r
        })
    )
    renderWithIntl(<AvatarPicker open onOpenChange={jest.fn()} />)
    const use = screen.getByRole('button', { name: 'Use the Initial' })
    fireEvent.click(use)
    fireEvent.click(use)
    expect(mockUpdateUserById).toHaveBeenCalledTimes(1)
    await act(async () => resolve({ data: {} }))
})
it('resets to the initial when reopened', () => {
    const { rerender } = renderWithIntl(<AvatarPicker open onOpenChange={jest.fn()} />)
    roll()
    rerender(<AvatarPicker open={false} onOpenChange={jest.fn()} />)
    rerender(<AvatarPicker open onOpenChange={jest.fn()} />)
    expect(screen.getByRole('radio', { name: 'S' })).toHaveAttribute('aria-checked', 'true')
})
