import { act, fireEvent, screen } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import { useContacts, type Contact } from '@/hooks/useContacts'
import ContactsView from '../views/Contacts.view'

const mockPush = jest.fn()
const mockInvitedUsernames = new Set<string>()

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }))
jest.mock('@/hooks/useContacts', () => ({ useContacts: jest.fn() }))
jest.mock('@/hooks/useInfiniteScroll', () => ({ useInfiniteScroll: () => ({ loaderRef: { current: null } }) }))
jest.mock('@/hooks/useAppHaptic', () => ({ useAppHaptic: () => ({ triggerHaptic: jest.fn() }) }))
jest.mock('@/context/authContext', () => ({
    useAuth: () => ({ invitedUsernamesSet: mockInvitedUsernames, user: null }),
}))
jest.mock('@/components/Global/NavHeader', () => ({
    __esModule: true,
    default: ({ title }: { title: string }) => <h1>{title}</h1>,
}))
jest.mock('@/components/Profile/AvatarWithBadge', () => ({ __esModule: true, default: () => null }))

beforeEach(() => {
    jest.clearAllMocks()
    mockInvitedUsernames.clear()
})

it.each([
    { isVerified: true, sentBefore: false, invited: false, tooltip: 'This is a verified user.' },
    {
        isVerified: true,
        sentBefore: true,
        invited: false,
        tooltip: "This is a verified user and you've sent them money before.",
    },
    { isVerified: false, sentBefore: false, invited: true, tooltip: "You've invited Alex" },
])('keeps the contact action separate from the $tooltip badge', ({ isVerified, sentBefore, invited, tooltip }) => {
    if (invited) mockInvitedUsernames.add('alex')
    const contact: Contact = {
        userId: 'contact-test',
        username: 'alex',
        fullName: 'Alex',
        isVerified,
        showFullName: true,
        relationshipTypes: sentBefore ? ['sent_money'] : [],
        firstInteractionDate: '2026-09-08T00:00:00Z',
        lastInteractionDate: '2026-09-08T00:00:00Z',
        transactionCount: sentBefore ? 1 : 0,
    }
    jest.mocked(useContacts).mockReturnValue({
        contacts: [contact],
        isLoading: false,
        error: null,
        fetchNextPage: jest.fn(),
        hasNextPage: false,
        isFetchingNextPage: false,
        refetch: jest.fn(),
    })
    const { container } = renderWithIntl(<ContactsView onPrev={jest.fn()} />)
    const rowAction = screen.getByRole('button', { name: /Alex @alex/ })
    expect(rowAction.querySelector('button, a, input, select, textarea, [tabindex]')).toBeNull()
    const badge = container.querySelector('[tabindex="0"]') as HTMLElement
    expect(badge).not.toBeNull()
    expect(badge.closest('button')).toBeNull()

    act(() => badge.focus())
    expect(badge).toHaveFocus()
    expect(screen.getByRole('tooltip')).toHaveTextContent(tooltip)
    fireEvent.keyDown(badge, { key: 'Escape' })
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
    fireEvent.click(badge)
    expect(screen.getByRole('tooltip')).toHaveTextContent(tooltip)
    expect(mockPush).not.toHaveBeenCalled()

    fireEvent.click(rowAction)
    expect(mockPush).toHaveBeenCalledTimes(1)
    expect(mockPush).toHaveBeenCalledWith('/send/alex')
})
