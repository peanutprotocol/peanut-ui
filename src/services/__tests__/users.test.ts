/** @jest-environment jsdom */
import { AccountHasBalanceError, usersApi } from '@/services/users'
import { serverFetch } from '@/utils/api-fetch'

jest.mock('@/utils/api-fetch', () => ({
    serverFetch: jest.fn(),
    apiFetch: jest.fn(),
}))

const mockServerFetch = serverFetch as jest.MockedFunction<typeof serverFetch>

const response = (init: { ok: boolean; status?: number; body?: unknown; headers?: Record<string, string> }) =>
    ({
        ok: init.ok,
        status: init.status ?? (init.ok ? 200 : 500),
        headers: new Headers(init.headers),
        json: async () => {
            if (init.body === undefined) throw new SyntaxError('Unexpected end of JSON input')
            return init.body
        },
    }) as Response

describe('usersApi.checkUsername', () => {
    beforeEach(() => mockServerFetch.mockReset())

    it('POSTs the exact username and returns the minimal found state', async () => {
        mockServerFetch.mockResolvedValue(response({ ok: true, body: { found: true } }))

        await expect(usersApi.checkUsername('alice')).resolves.toEqual({ status: 'found' })
        expect(mockServerFetch).toHaveBeenCalledWith('/users/username/check', {
            method: 'POST',
            body: JSON.stringify({ username: 'alice' }),
        })
    })

    it('maps a miss without exposing profile data', async () => {
        mockServerFetch.mockResolvedValue(response({ ok: true, body: { found: false } }))

        await expect(usersApi.checkUsername('alice')).resolves.toEqual({ status: 'not-found' })
    })

    it('preserves the server retry window when rate limited', async () => {
        mockServerFetch.mockResolvedValue(response({ ok: false, status: 429, body: { retryAfterSeconds: 3600 } }))

        await expect(usersApi.checkUsername('alice')).resolves.toEqual({
            status: 'rate-limited',
            retryAfterSeconds: 3600,
        })
    })
})

describe('usersApi.requestDeletion', () => {
    beforeEach(() => mockServerFetch.mockReset())

    it('POSTs to /users/me/delete and resolves on success', async () => {
        mockServerFetch.mockResolvedValue(response({ ok: true }))

        await expect(usersApi.requestDeletion()).resolves.toBeUndefined()
        expect(mockServerFetch).toHaveBeenCalledWith('/users/me/delete', { method: 'POST' })
    })

    it('throws when the backend responds with an error', async () => {
        mockServerFetch.mockResolvedValue(response({ ok: false }))

        await expect(usersApi.requestDeletion()).rejects.toThrow('Failed to request account deletion')
    })

    // The balance refusal is what the delete modal branches on to show its
    // "move your money first" step, so it must arrive as its own type carrying
    // the server's figure — never as the generic failure.
    it('throws AccountHasBalanceError with the balance when the account still holds funds', async () => {
        mockServerFetch.mockResolvedValue(
            response({ ok: false, body: { error: 'ACCOUNT_HAS_BALANCE', balanceUsd: '12.34' } })
        )

        await expect(usersApi.requestDeletion()).rejects.toBeInstanceOf(AccountHasBalanceError)
        await expect(usersApi.requestDeletion()).rejects.toMatchObject({ balanceUsd: '12.34' })
    })

    it('tolerates a balance refusal that omits the amount', async () => {
        mockServerFetch.mockResolvedValue(response({ ok: false, body: { error: 'ACCOUNT_HAS_BALANCE' } }))

        await expect(usersApi.requestDeletion()).rejects.toMatchObject({ balanceUsd: null })
    })

    it('falls back to the generic failure for other error codes', async () => {
        mockServerFetch.mockResolvedValue(response({ ok: false, body: { error: 'BALANCE_UNAVAILABLE' } }))

        await expect(usersApi.requestDeletion()).rejects.toThrow('Failed to request account deletion')
    })
})
