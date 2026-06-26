/** @jest-environment jsdom */
import { accountApi } from '@/services/account'
import { apiFetch } from '@/utils/api-fetch'

jest.mock('@/utils/api-fetch', () => ({
    apiFetch: jest.fn(),
}))

const mockApiFetch = apiFetch as jest.MockedFunction<typeof apiFetch>

describe('accountApi.requestDeletion', () => {
    beforeEach(() => mockApiFetch.mockReset())

    it('POSTs to /users/me/delete and resolves on success', async () => {
        mockApiFetch.mockResolvedValue({ ok: true } as Response)

        await expect(accountApi.requestDeletion()).resolves.toBeUndefined()
        expect(mockApiFetch).toHaveBeenCalledWith('/users/me/delete', { method: 'POST' })
    })

    it('throws when the backend responds with an error', async () => {
        mockApiFetch.mockResolvedValue({ ok: false } as Response)

        await expect(accountApi.requestDeletion()).rejects.toThrow('Failed to request account deletion')
    })
})
