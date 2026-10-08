/** @jest-environment jsdom */
import { AccountHasBalanceError, usersApi } from '@/services/users'
import { apiFetch, serverFetch } from '@/utils/api-fetch'

jest.mock('@/utils/api-fetch', () => ({
    serverFetch: jest.fn(),
    apiFetch: jest.fn(),
}))

const mockServerFetch = serverFetch as jest.MockedFunction<typeof serverFetch>
const mockApiFetch = apiFetch as jest.MockedFunction<typeof apiFetch>

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

    it('preserves the EURC deletion gate without inventing a dollar balance', async () => {
        mockServerFetch.mockResolvedValue(
            response({ ok: false, body: { error: 'ACCOUNT_HAS_BALANCE', currency: 'EURC' } })
        )
        await expect(usersApi.requestDeletion()).rejects.toMatchObject({ balanceUsd: null, currency: 'EURC' })
    })

    it('falls back to the generic failure for other error codes', async () => {
        mockServerFetch.mockResolvedValue(response({ ok: false, body: { error: 'BALANCE_UNAVAILABLE' } }))

        await expect(usersApi.requestDeletion()).rejects.toThrow('Failed to request account deletion')
    })
})

it.each([
    {
        status: 409,
        body: { error: 'A deposit is still arriving.', code: 'DEPOSIT_IN_FLIGHT' },
        code: 'DEPOSIT_IN_FLIGHT',
    },
    { status: 503, body: { error: 'DEPOSIT_ACCOUNTS_UNAVAILABLE' }, code: 'DEPOSIT_ACCOUNTS_UNAVAILABLE' },
])('preserves deletion refusal $code for localized UI copy', async ({ status, body, code }) => {
    mockServerFetch.mockResolvedValue(response({ ok: false, status, body }))
    await expect(usersApi.requestDeletion()).rejects.toMatchObject({ name: 'ApiError', status, code })
})

describe('usersApi.requestByUsername', () => {
    beforeEach(() => mockApiFetch.mockReset())

    const sentCharge = () => JSON.parse(mockApiFetch.mock.calls[0][1]!.body as string)

    it('asks for the typed amount', async () => {
        mockApiFetch.mockResolvedValue(response({ ok: true, body: { data: { id: 'c1' } } }))
        await usersApi.requestByUsername({ username: 'alice', amount: '5', toAddress: '0xabc' })
        expect(sentCharge()).toMatchObject({
            pricing_type: 'fixed_price',
            local_price: { amount: '5', currency: 'USD' },
            requestProps: { requesteeUsername: 'alice', recipientAddress: '0xabc' },
        })
    })

    it('leaves a blank amount to the requestee', async () => {
        mockApiFetch.mockResolvedValue(response({ ok: true, body: { data: { id: 'c1' } } }))
        await usersApi.requestByUsername({ username: 'alice', amount: '', toAddress: '0xabc' })
        expect(sentCharge()).toMatchObject({ pricing_type: 'no_price', requestProps: { requesteeUsername: 'alice' } })
        expect(sentCharge()).not.toHaveProperty('local_price')
    })
})
