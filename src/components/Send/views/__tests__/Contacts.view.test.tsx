/**
 * Contacts row avatar (TASK-22625). A contact is a person, so their row shows
 * the avatar they picked — or the letter sticker of their username, never the
 * two-letter initials of a full name they may not even show.
 */
import React from 'react'
import { screen } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import { type Contact } from '@/interfaces/interfaces'
import ContactsView from '../Contacts.view'

const mockUseContacts = jest.fn()

jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: jest.fn() }),
    usePathname: () => '/send',
}))
jest.mock('@/hooks/useContacts', () => ({ useContacts: () => mockUseContacts() }))
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

const renderContacts = (contacts: Contact[]) => {
    mockUseContacts.mockReturnValue({
        contacts,
        isLoading: false,
        error: null,
        fetchNextPage: jest.fn(),
        hasNextPage: false,
        isFetchingNextPage: false,
        refetch: jest.fn(),
    })
    return renderWithIntl(<ContactsView onPrev={jest.fn()} />)
}

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
