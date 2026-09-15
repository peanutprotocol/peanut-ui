/**
 * Contacts row avatar (TASK-22625). A contact is a person, so their row shows
 * the avatar they picked — or the letter sticker of their username, never the
 * two-letter initials of a full name they may not even show.
 */
import React from 'react'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import { type Contact } from '@/interfaces/interfaces'
import ContactsView from '../Contacts.view'

const mockUseContacts = jest.fn()
const mockCheckUsername = jest.fn()
const mockRouterPush = jest.fn()

jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: mockRouterPush }),
    usePathname: () => '/send',
}))
jest.mock('@/hooks/useContacts', () => ({ useContacts: () => mockUseContacts() }))
jest.mock('@/services/users', () => ({
    usersApi: { checkUsername: (...args: unknown[]) => mockCheckUsername(...args) },
}))
jest.mock('@/hooks/useDebounce', () => ({ useDebounce: (value: string) => value }))
jest.mock('@/hooks/useInfiniteScroll', () => ({ useInfiniteScroll: () => ({ loaderRef: { current: null } }) }))
jest.mock('@/components/UserHeader', () => ({
    VerifiedUserLabel: ({ name }: { name: string }) => <span>{name}</span>,
}))
jest.mock('next/image', () => ({
    __esModule: true,
    default: ({ unoptimized, ...rest }: React.ComponentProps<'img'> & { unoptimized?: boolean }) => <img {...rest} />,
}))

const contact = (overrides: Partial<Contact>): Contact => ({
    userId: 'user-1',
    username: 'satoshi',
    fullName: 'Satoshi Nakamoto',
    isVerified: false,
    showFullName: true,
    relationshipTypes: [],
    firstInteractionDate: '2026-01-01T00:00:00Z',
    lastInteractionDate: '2026-01-01T00:00:00Z',
    transactionCount: 1,
    ...overrides,
})

const renderContacts = (contacts: Contact[], error: Error | null = null, isLoading = false) => {
    mockUseContacts.mockReturnValue({
        contacts,
        isLoading,
        error,
        fetchNextPage: jest.fn(),
        hasNextPage: false,
        isFetchingNextPage: false,
        refetch: jest.fn(),
    })
    return renderWithIntl(<ContactsView onPrev={jest.fn()} />)
}

beforeEach(() => {
    jest.clearAllMocks()
    mockCheckUsername.mockResolvedValue({ status: 'not-found' })
})

describe('ContactsView avatars', () => {
    it('renders the contact picked avatar', () => {
        const { container } = renderContacts([contact({ avatarKey: 'basic.frog' })])

        expect(container.querySelector('img')).toHaveAttribute('src', '/avatars/basic/frog.webp')
    })

    // The row already shows the full name; the sticker follows the username so
    // one person looks the same here and on their profile.
    it('falls back to the username letter, not the full-name initials', () => {
        const { container } = renderContacts([contact({ avatarKey: null })])

        expect(container.querySelector('img')).toHaveAttribute('src', '/avatars/letter/s.webp')
        expect(screen.queryByText('SN')).not.toBeInTheDocument()
    })

    it('keeps the avatar out of the accessibility tree — the row names the contact', () => {
        renderContacts([contact({ avatarKey: 'basic.frog' })])

        expect(screen.queryByRole('img')).not.toBeInTheDocument()
    })
})

describe('ContactsView exact username entry', () => {
    it('keeps username entry available when the user has no contacts', () => {
        renderContacts([], new Error('Contacts unavailable'))

        expect(screen.getByRole('textbox', { name: 'Peanut username or contact' })).toBeInTheDocument()
    })

    it('checks a valid exact username outside the contact list and opens direct send', async () => {
        mockCheckUsername.mockResolvedValue({ status: 'found' })
        renderContacts([])

        fireEvent.change(screen.getByRole('textbox', { name: 'Peanut username or contact' }), {
            target: { value: '@GLOBEE' },
        })

        await waitFor(() => expect(mockCheckUsername).toHaveBeenLastCalledWith('globee'))
        fireEvent.click(await screen.findByRole('button', { name: /@globee found/i }))
        expect(mockRouterPush).toHaveBeenCalledWith('/send/globee')
    })

    it('keeps an exact username actionable while contacts are still loading', async () => {
        mockCheckUsername.mockResolvedValue({ status: 'found' })
        renderContacts([], null, true)

        fireEvent.change(screen.getByRole('textbox', { name: 'Peanut username or contact' }), {
            target: { value: 'globee' },
        })

        await waitFor(() => expect(mockCheckUsername).toHaveBeenCalledWith('globee'))
        expect(await screen.findByRole('button', { name: /@globee found/i })).toBeInTheDocument()
    })

    it('does not check input that cannot be a Peanut username', async () => {
        renderContacts([])

        fireEvent.change(screen.getByRole('textbox', { name: 'Peanut username or contact' }), {
            target: { value: 'not-valid!' },
        })

        await waitFor(() => expect(mockCheckUsername).not.toHaveBeenCalled())
        expect(screen.getByText('Enter a valid Peanut username.')).toBeInTheDocument()
    })

    it('keeps an exact miss neutral when the query matches a contact name', async () => {
        renderContacts([contact({ username: 'globee1', fullName: 'Alice Smith' })])
        const input = screen.getByRole('textbox', { name: 'Peanut username or contact' })

        fireEvent.change(input, { target: { value: 'alice' } })

        await waitFor(() => expect(mockCheckUsername).toHaveBeenCalledWith('alice'))
        expect(screen.getByText('Alice Smith')).toBeInTheDocument()
        expect(screen.queryByText("We couldn't find that exact username.")).not.toBeInTheDocument()
        expect(input.closest('[data-input-container="true"]')).not.toHaveClass('border-border-error')
    })

    it('keeps a contact-name match neutral when the exact lookup is rate-limited', async () => {
        mockCheckUsername.mockResolvedValue({ status: 'rate-limited', retryAfterSeconds: 3600 })
        renderContacts([contact({ username: 'globee1', fullName: 'Alice Smith' })])
        const input = screen.getByRole('textbox', { name: 'Peanut username or contact' })

        fireEvent.change(input, { target: { value: 'alice' } })

        await waitFor(() => expect(mockCheckUsername).toHaveBeenCalledWith('alice'))
        expect(screen.getByText('Alice Smith')).toBeInTheDocument()
        expect(screen.queryByText('Too many username checks. Please try again later.')).not.toBeInTheDocument()
        expect(input.closest('[data-input-container="true"]')).not.toHaveClass('border-border-error')
    })

    it('keeps a contact-name match neutral when the exact lookup fails', async () => {
        mockCheckUsername.mockRejectedValue(new Error('timeout'))
        renderContacts([contact({ username: 'globee1', fullName: 'Alice Smith' })])
        const input = screen.getByRole('textbox', { name: 'Peanut username or contact' })

        fireEvent.change(input, { target: { value: 'alice' } })

        await waitFor(() => expect(mockCheckUsername).toHaveBeenCalledWith('alice'))
        expect(screen.getByText('Alice Smith')).toBeInTheDocument()
        expect(screen.queryByText("We couldn't check that username. Please try again.")).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument()
        expect(input.closest('[data-input-container="true"]')).not.toHaveClass('border-border-error')
    })

    it('treats a full-name match as a contact query instead of an invalid username', async () => {
        renderContacts([contact({ username: 'globee1', fullName: 'Alice Smith' })])
        const input = screen.getByRole('textbox', { name: 'Peanut username or contact' })

        fireEvent.change(input, { target: { value: 'Alice Smith' } })

        await waitFor(() => expect(screen.getByText('Alice Smith')).toBeInTheDocument())
        expect(mockCheckUsername).not.toHaveBeenCalled()
        expect(screen.queryByText('Enter a valid Peanut username.')).not.toBeInTheDocument()
        expect(input.closest('[data-input-container="true"]')).not.toHaveClass('border-border-error')
    })

    it('shows username syntax feedback when a full-name query has no contact match', async () => {
        renderContacts([])

        fireEvent.change(screen.getByRole('textbox', { name: 'Peanut username or contact' }), {
            target: { value: 'Alice Smith' },
        })

        expect(await screen.findByText('Enter a valid Peanut username.')).toBeInTheDocument()
        expect(mockCheckUsername).not.toHaveBeenCalled()
    })

    it('shows a specific message when the lookup quota is exhausted', async () => {
        mockCheckUsername.mockResolvedValue({ status: 'rate-limited', retryAfterSeconds: 3600 })
        renderContacts([])

        fireEvent.change(screen.getByRole('textbox', { name: 'Peanut username or contact' }), {
            target: { value: 'globee' },
        })

        expect(await screen.findByText('Too many username checks. Please try again later.')).toBeInTheDocument()
        expect(screen.queryByText('No username or contact found')).not.toBeInTheDocument()
        expect(screen.queryByText('No contacts yet')).not.toBeInTheDocument()
    })

    it('discards an older lookup that completes after the current username', async () => {
        let resolveFirst: (value: { status: 'not-found' }) => void = () => undefined
        let resolveSecond: (value: { status: 'found' }) => void = () => undefined
        mockCheckUsername.mockImplementation(
            (username: string) =>
                new Promise((resolve) => {
                    if (username === 'alice1') resolveFirst = resolve
                    if (username === 'bob22') resolveSecond = resolve
                })
        )
        renderContacts([])
        const input = screen.getByRole('textbox', { name: 'Peanut username or contact' })

        fireEvent.change(input, { target: { value: 'alice1' } })
        await waitFor(() => expect(mockCheckUsername).toHaveBeenCalledWith('alice1'))
        fireEvent.change(input, { target: { value: 'bob22' } })
        await waitFor(() => expect(mockCheckUsername).toHaveBeenCalledWith('bob22'))

        await act(async () => resolveSecond({ status: 'found' }))
        expect(await screen.findByRole('button', { name: /@bob22 found/i })).toBeInTheDocument()
        await act(async () => resolveFirst({ status: 'not-found' }))
        expect(screen.getByRole('button', { name: /@bob22 found/i })).toBeInTheDocument()
        expect(screen.queryByText("We couldn't find that exact username.")).not.toBeInTheDocument()
    })

    it('retries an operational lookup failure without editing the input', async () => {
        mockCheckUsername.mockRejectedValueOnce(new Error('timeout')).mockResolvedValueOnce({ status: 'found' })
        renderContacts([])

        fireEvent.change(screen.getByRole('textbox', { name: 'Peanut username or contact' }), {
            target: { value: 'globee' },
        })

        expect(await screen.findByText("We couldn't check that username. Please try again.")).toBeInTheDocument()
        expect(screen.queryByText('No username or contact found')).not.toBeInTheDocument()
        expect(screen.queryByText('No contacts yet')).not.toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Retry' }))

        await waitFor(() => expect(mockCheckUsername).toHaveBeenCalledTimes(2))
        expect(await screen.findByRole('button', { name: /@globee found/i })).toBeInTheDocument()
    })
})
