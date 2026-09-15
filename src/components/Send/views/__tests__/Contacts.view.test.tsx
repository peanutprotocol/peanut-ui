/**
 * Contacts row avatar (TASK-22625). A contact is a person, so their row shows
 * the avatar they picked — or the letter sticker of their username, never the
 * two-letter initials of a full name they may not even show.
 */
import React from 'react'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import { type Contact } from '@/interfaces/interfaces'
import ContactsView from '../Contacts.view'

const mockUseContacts = jest.fn()
const mockUseUserByUsername = jest.fn()
const mockRouterPush = jest.fn()

jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: mockRouterPush }),
    usePathname: () => '/send',
}))
jest.mock('@/hooks/useContacts', () => ({ useContacts: () => mockUseContacts() }))
jest.mock('@/hooks/useUserByUsername', () => ({
    useUserByUsername: (username: string | null) => mockUseUserByUsername(username),
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

const renderContacts = (contacts: Contact[], error: Error | null = null) => {
    mockUseContacts.mockReturnValue({
        contacts,
        isLoading: false,
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
    mockUseUserByUsername.mockReturnValue({ user: null, isLoading: false, error: null })
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

    it('resolves a valid exact username outside the contact list and opens direct send', () => {
        mockUseUserByUsername.mockImplementation((username: string | null) => ({
            user:
                username === 'globee'
                    ? {
                          userId: 'global-user',
                          username: 'globee',
                          accounts: [],
                          fullName: 'Global User',
                          firstName: 'Global',
                          lastName: 'User',
                          showFullName: true,
                          totalUsdSentToCurrentUser: '0',
                          totalUsdReceivedFromCurrentUser: '0',
                          isVerified: false,
                      }
                    : null,
            isLoading: false,
            error: null,
        }))
        renderContacts([])

        fireEvent.change(screen.getByRole('textbox', { name: 'Peanut username or contact' }), {
            target: { value: '@GLOBEE' },
        })

        expect(mockUseUserByUsername).toHaveBeenLastCalledWith('globee')
        fireEvent.click(screen.getByRole('button', { name: /Global User/i }))
        expect(mockRouterPush).toHaveBeenCalledWith('/send/globee')
    })

    it('does not look up input that cannot be a Peanut username', () => {
        renderContacts([])

        fireEvent.change(screen.getByRole('textbox', { name: 'Peanut username or contact' }), {
            target: { value: 'not-valid!' },
        })

        expect(mockUseUserByUsername).toHaveBeenLastCalledWith(null)
        expect(screen.getByText('No username or contact found')).toBeInTheDocument()
    })
})
