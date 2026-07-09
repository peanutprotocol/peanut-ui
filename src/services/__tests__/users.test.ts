/** @jest-environment jsdom */
import { usersApi } from '@/services/users'
import { serverFetch } from '@/utils/api-fetch'

jest.mock('@/utils/api-fetch', () => ({
    serverFetch: jest.fn(),
    apiFetch: jest.fn(),
}))

const mockServerFetch = serverFetch as jest.MockedFunction<typeof serverFetch>

describe('usersApi.requestDeletion', () => {
    beforeEach(() => mockServerFetch.mockReset())

    it('POSTs to /users/me/delete and resolves on success', async () => {
        mockServerFetch.mockResolvedValue({ ok: true } as Response)

        await expect(usersApi.requestDeletion()).resolves.toBeUndefined()
        expect(mockServerFetch).toHaveBeenCalledWith('/users/me/delete', { method: 'POST' })
    })

    it('throws when the backend responds with an error', async () => {
        mockServerFetch.mockResolvedValue({ ok: false } as Response)

        await expect(usersApi.requestDeletion()).rejects.toThrow('Failed to request account deletion')
    })
})
