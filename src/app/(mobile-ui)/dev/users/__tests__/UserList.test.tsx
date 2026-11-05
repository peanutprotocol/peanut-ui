import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import UserList from '../_components/UserList'
import type { UserListItem } from '../userRecords.types'

jest.mock('../userRecords.api', () => ({ fetchUserList: jest.fn() }))
jest.mock('@/components/Global/Badges/Badge', () => ({
    __esModule: true,
    default: ({ customText }: { customText?: string }) => <span>{customText}</span>,
}))

const { fetchUserList } = jest.requireMock('../userRecords.api') as { fetchUserList: jest.Mock }

const user = (id: string, name: string): UserListItem => ({
    user_id: id,
    username: name.toLowerCase(),
    full_name: name,
    first_name: null,
    last_name: null,
    email: null,
    created_at: '2026-10-01T00:00:00.000Z',
    updated_at: '2026-10-02T00:00:00.000Z',
    is_active: true,
    residence_country: null,
    kyc_status: null,
})

function renderList(selectedId: string | null) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    return render(
        <QueryClientProvider client={client}>
            <UserList query="" sort="updated" selectedId={selectedId} onSelect={jest.fn()} />
        </QueryClientProvider>
    )
}

describe('UserList selection', () => {
    beforeEach(() => fetchUserList.mockResolvedValue({ users: [user('u1', 'Ana'), user('u2', 'Ben')], next: null }))

    it('announces the selected user on its focusable row and marks its list item current', async () => {
        renderList('u2')
        const selected = await screen.findByRole('button', { name: /^Ben\s*, selected/ })
        expect(selected.closest('li')).toHaveAttribute('aria-current', 'true')
        expect(screen.getByRole('button', { name: /^Ana/ })).not.toHaveAccessibleName(/selected/)
        expect(screen.getByRole('button', { name: /^Ana/ }).closest('li')).not.toHaveAttribute('aria-current')
    })
})
