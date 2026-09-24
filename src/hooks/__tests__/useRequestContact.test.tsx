import React from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useRequestContact } from '../useRequestContact'

let mockUserId: string | undefined = 'sender'
jest.mock('@/context/authContext', () => ({
    useAuth: () => ({ user: mockUserId ? { user: { userId: mockUserId } } : null }),
}))
const mockGetContacts = jest.fn()
jest.mock('@/app/actions/users', () => ({ getContacts: (...args: unknown[]) => mockGetContacts(...args) }))

function wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
let client: QueryClient
beforeEach(() => {
    client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
    mockUserId = 'sender'
    mockGetContacts.mockReset()
})
afterEach(() => client.clear())

it.each(['sent_money', 'received_money'])('allows a canonical %s relationship', async (relationship) => {
    const contact = { username: 'Alice', relationshipTypes: [relationship] }
    mockGetContacts.mockResolvedValue({ data: { contacts: [contact], hasMore: false } })
    const { result } = renderHook(() => useRequestContact('alice'), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(contact)
})

it.each([['inviter'], ['invitee'], ['inviter', 'invitee']])(
    'rejects invitation-only contacts (%s)',
    async (...types) => {
        mockGetContacts.mockResolvedValue({
            data: { contacts: [{ username: 'alice', relationshipTypes: types }], hasMore: false },
        })
        const { result } = renderHook(() => useRequestContact('alice'), { wrapper })
        await waitFor(() => expect(result.current.isSuccess).toBe(true))
        expect(result.current.data).toBeNull()
    }
)

it('searches all pages and matches the exact username rather than a partial search hit', async () => {
    const contact = { username: 'alice', relationshipTypes: ['received_money'] }
    mockGetContacts
        .mockResolvedValueOnce({
            data: { contacts: [{ username: 'alice2', relationshipTypes: ['sent_money'] }], hasMore: true },
        })
        .mockResolvedValueOnce({ data: { contacts: [contact], hasMore: false } })
    const { result } = renderHook(() => useRequestContact('ALICE'), { wrapper })
    await waitFor(() => expect(result.current.data).toEqual(contact))
    expect(mockGetContacts).toHaveBeenNthCalledWith(1, { search: 'alice', limit: 50, offset: 0 })
    expect(mockGetContacts).toHaveBeenNthCalledWith(2, { search: 'alice', limit: 50, offset: 50 })
})

it('returns an error rather than treating failed contact lookup as an eligible recipient', async () => {
    mockGetContacts.mockResolvedValue({ error: 'Unavailable' })
    const { result } = renderHook(() => useRequestContact('alice'), { wrapper })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.data).toBeUndefined()
})

it('does not query contacts for guests', () => {
    mockUserId = undefined
    renderHook(() => useRequestContact('alice'), { wrapper })
    expect(mockGetContacts).not.toHaveBeenCalled()
})

it('does not reuse eligibility when the signed-in account changes', async () => {
    mockGetContacts.mockResolvedValueOnce({
        data: { contacts: [{ username: 'alice', relationshipTypes: ['sent_money'] }], hasMore: false },
    })
    const { result, rerender } = renderHook(() => useRequestContact('alice'), { wrapper })
    await waitFor(() => expect(result.current.data).toBeTruthy())
    mockGetContacts.mockResolvedValueOnce({ data: { contacts: [], hasMore: false } })
    mockUserId = 'different-sender'
    rerender()
    expect(result.current.data).toBeUndefined()
    await waitFor(() => expect(result.current.data).toBeNull())
})
