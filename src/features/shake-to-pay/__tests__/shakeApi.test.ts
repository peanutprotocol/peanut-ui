import { ApiError } from '@/services/api-error'
import { shakeApi } from '../shakeApi'
import type { ShakeLocation, ShakeSessionResponse } from '../shakeApi'

const mockServerFetch = jest.fn()
jest.mock('@/utils/api-fetch', () => ({
    serverFetch: (...args: unknown[]) => mockServerFetch(...args),
}))

/**
 * jsdom has no Response, so this is the part of one that callers use. It can be
 * read as JSON or as text and behaves like the real thing for a body that is
 * not JSON (json() rejects, text() hands the raw string over).
 */
function fakeResponse(status: number, body?: unknown, { raw }: { raw?: string } = {}) {
    const text = raw ?? (body === undefined ? '' : JSON.stringify(body))
    const make = (): unknown => ({
        ok: status >= 200 && status < 300,
        status,
        statusText: '',
        headers: { get: () => null },
        json: () => Promise.resolve().then(() => JSON.parse(text)),
        text: () => Promise.resolve(text),
        clone: () => make(),
    })
    return make()
}

const SESSION: ShakeSessionResponse = {
    sessionId: '0b0f3a0e-7b0a-4d83-9d52-3f3a0c1a2b3c',
    shakenAt: '2026-10-12T10:00:00.000Z',
    expiresAt: '2026-10-12T10:01:30.000Z',
    status: 'active',
    candidates: [
        { username: 'ana', displayName: 'Ana Gomez', avatarKey: 'basic.cat', isVerified: true },
        { username: 'bob', displayName: null, avatarKey: null, isVerified: false },
    ],
}

const LOCATION: ShakeLocation = { latitude: 52.37, longitude: 4.895, accuracyM: 35 }

async function rejection(promise: Promise<unknown>): Promise<unknown> {
    try {
        await promise
    } catch (error) {
        return error
    }
    throw new Error('expected the promise to reject, but it resolved')
}

const lastCall = () => {
    const [path, init] = mockServerFetch.mock.calls[mockServerFetch.mock.calls.length - 1] as [
        string,
        (RequestInit & { includeAuth?: boolean }) | undefined,
    ]
    return { path, init }
}

const sentBody = () => JSON.parse(String(lastCall().init?.body))

beforeEach(() => {
    mockServerFetch.mockReset()
})

describe('shakeApi.createSession', () => {
    it('POSTs /shake/sessions with an empty JSON object when there is no location', async () => {
        mockServerFetch.mockResolvedValue(fakeResponse(201, SESSION))

        await shakeApi.createSession()

        expect(mockServerFetch).toHaveBeenCalledTimes(1)
        expect(lastCall().path).toBe('/shake/sessions')
        expect(lastCall().init?.method).toBe('POST')
        expect(typeof lastCall().init?.body).toBe('string')
        expect(sentBody()).toEqual({})
    })

    it.each([[null], [undefined]])('sends {} when the location is %s', async (location) => {
        mockServerFetch.mockResolvedValue(fakeResponse(201, SESSION))

        await shakeApi.createSession(location)

        expect(sentBody()).toEqual({})
        expect(Object.keys(sentBody())).toEqual([])
    })

    it('sends { location } when a location is given', async () => {
        mockServerFetch.mockResolvedValue(fakeResponse(201, SESSION))

        await shakeApi.createSession(LOCATION)

        expect(lastCall().path).toBe('/shake/sessions')
        expect(lastCall().init?.method).toBe('POST')
        expect(sentBody()).toEqual({ location: LOCATION })
    })

    it('sends nothing but the location: no identity or extra fields ride along', async () => {
        mockServerFetch.mockResolvedValue(fakeResponse(201, SESSION))

        await shakeApi.createSession(LOCATION)

        expect(Object.keys(sentBody())).toEqual(['location'])
        expect(Object.keys(sentBody().location).sort()).toEqual(['accuracyM', 'latitude', 'longitude'])
        expect(lastCall().path).not.toContain('?')
    })

    it('stays an authenticated call: it does not opt out of the bearer token', async () => {
        mockServerFetch.mockResolvedValue(fakeResponse(201, SESSION))

        await shakeApi.createSession(LOCATION)

        expect(lastCall().init?.includeAuth).not.toBe(false)
    })

    it('resolves with the session the server returned', async () => {
        mockServerFetch.mockResolvedValue(fakeResponse(201, SESSION))

        await expect(shakeApi.createSession(LOCATION)).resolves.toEqual(SESSION)
    })

    it('also accepts a 200', async () => {
        mockServerFetch.mockResolvedValue(fakeResponse(200, SESSION))

        await expect(shakeApi.createSession()).resolves.toEqual(SESSION)
    })

    it('429 becomes an ApiError with status, code and retryAfterSec taken from retryAfterSeconds', async () => {
        mockServerFetch.mockResolvedValue(
            fakeResponse(429, { error: 'Too many shakes', code: 'SHAKE_RATE_LIMITED', retryAfterSeconds: 42 })
        )

        const error = await rejection(shakeApi.createSession(LOCATION))

        expect(error).toBeInstanceOf(ApiError)
        expect(error).toMatchObject({ status: 429, code: 'SHAKE_RATE_LIMITED', retryAfterSec: 42 })
    })

    it('passes the smallest retryAfterSeconds (1) through as a number', async () => {
        mockServerFetch.mockResolvedValue(
            fakeResponse(429, { error: 'Too many shakes', code: 'SHAKE_RATE_LIMITED', retryAfterSeconds: 1 })
        )

        const error = (await rejection(shakeApi.createSession())) as ApiError

        expect(error.retryAfterSec).toBe(1)
    })

    it('403 SHAKE_USERNAME_REQUIRED becomes an ApiError carrying that code and no retryAfterSec', async () => {
        mockServerFetch.mockResolvedValue(
            fakeResponse(403, { error: 'Pick a username first', code: 'SHAKE_USERNAME_REQUIRED' })
        )

        const error = (await rejection(shakeApi.createSession())) as ApiError

        expect(error).toBeInstanceOf(ApiError)
        expect(error.status).toBe(403)
        expect(error.code).toBe('SHAKE_USERNAME_REQUIRED')
        expect(error.retryAfterSec).toBeUndefined()
    })

    it.each([400, 401, 500, 503])('%i with a JSON error body becomes an ApiError with that status', async (status) => {
        mockServerFetch.mockResolvedValue(fakeResponse(status, { error: 'nope', code: 'SOME_CODE' }))

        const error = await rejection(shakeApi.createSession())

        expect(error).toBeInstanceOf(ApiError)
        expect(error).toMatchObject({ status, code: 'SOME_CODE' })
    })

    it('an error body without a code leaves code undefined', async () => {
        mockServerFetch.mockResolvedValue(fakeResponse(500, { error: 'Internal Server Error' }))

        const error = (await rejection(shakeApi.createSession())) as ApiError

        expect(error).toBeInstanceOf(ApiError)
        expect(error.status).toBe(500)
        expect(error.code).toBeUndefined()
    })

    it.each<[string, unknown]>([
        ['a string', 'soon'],
        ['null', null],
        ['an object', { seconds: 5 }],
    ])('a retryAfterSeconds that is %s does not leak into retryAfterSec as a non-number', async (_label, value) => {
        mockServerFetch.mockResolvedValue(
            fakeResponse(429, { error: 'Too many', code: 'SHAKE_RATE_LIMITED', retryAfterSeconds: value })
        )

        const error = (await rejection(shakeApi.createSession())) as ApiError

        expect(error).toBeInstanceOf(ApiError)
        expect(error.status).toBe(429)
        expect(error.retryAfterSec).toBeUndefined()
    })

    it('a non-string code is not copied onto the error', async () => {
        mockServerFetch.mockResolvedValue(fakeResponse(500, { error: 'x', code: 500 }))

        const error = (await rejection(shakeApi.createSession())) as ApiError

        expect(error).toBeInstanceOf(ApiError)
        expect(error.code).toBeUndefined()
    })

    it.each<[string, number, string]>([
        ['an HTML error page', 502, '<html><body><h1>502 Bad Gateway</h1></body></html>'],
        ['an empty body', 500, ''],
        ['plain text', 503, 'upstream connect error'],
        ['a JSON string', 500, '"oops"'],
        ['JSON null', 500, 'null'],
        ['a JSON array', 500, '[1,2,3]'],
        ['truncated JSON', 500, '{"error":"bo'],
    ])('%s still throws an ApiError with the HTTP status', async (_label, status, raw) => {
        mockServerFetch.mockResolvedValue(fakeResponse(status, undefined, { raw }))

        const error = (await rejection(shakeApi.createSession())) as ApiError

        expect(error).toBeInstanceOf(ApiError)
        expect(error.status).toBe(status)
        expect(error.code).toBeUndefined()
        expect(error.retryAfterSec).toBeUndefined()
        expect(typeof error.message).toBe('string')
        expect(error.message).not.toBe('')
    })

    it('does not retry on its own: a failed create is one request', async () => {
        mockServerFetch.mockResolvedValue(fakeResponse(500, { error: 'boom' }))

        await rejection(shakeApi.createSession(LOCATION))

        expect(mockServerFetch).toHaveBeenCalledTimes(1)
    })

    it('lets a network failure surface as a rejection', async () => {
        mockServerFetch.mockRejectedValue(new TypeError('Failed to fetch'))

        const error = await rejection(shakeApi.createSession())

        expect(error).toBeInstanceOf(Error)
        expect((error as Error).message).toContain('Failed to fetch')
        expect(mockServerFetch).toHaveBeenCalledTimes(1)
    })

    it('a 2xx whose body is not JSON rejects rather than resolving with garbage', async () => {
        mockServerFetch.mockResolvedValue(fakeResponse(200, undefined, { raw: '<html>captive portal</html>' }))

        await expect(shakeApi.createSession()).rejects.toBeDefined()
    })
})

describe('shakeApi.getSession', () => {
    it('GETs /shake/sessions/<id> without a body', async () => {
        mockServerFetch.mockResolvedValue(fakeResponse(200, SESSION))

        await shakeApi.getSession(SESSION.sessionId)

        expect(mockServerFetch).toHaveBeenCalledTimes(1)
        expect(lastCall().path).toBe(`/shake/sessions/${SESSION.sessionId}`)
        expect(lastCall().init?.method ?? 'GET').toBe('GET')
        expect(lastCall().init?.body).toBeUndefined()
        expect(lastCall().init?.includeAuth).not.toBe(false)
    })

    it('resolves with the session the server returned', async () => {
        mockServerFetch.mockResolvedValue(fakeResponse(200, SESSION))

        await expect(shakeApi.getSession(SESSION.sessionId)).resolves.toEqual(SESSION)
    })

    it('passes an expired or cancelled session through unchanged', async () => {
        const expired: ShakeSessionResponse = { ...SESSION, status: 'expired', candidates: [] }
        mockServerFetch.mockResolvedValue(fakeResponse(200, expired))

        await expect(shakeApi.getSession(SESSION.sessionId)).resolves.toEqual(expired)
    })

    it.each([
        ['a/b c?d#e%', 'slashes, spaces, ? # and %'],
        ['../admin', 'path traversal'],
        ['x?sessionId=other', 'a query string'],
        ['ünï-€', 'non-ASCII'],
    ])('URI-encodes the id (%s: %s)', async (id) => {
        mockServerFetch.mockResolvedValue(fakeResponse(200, SESSION))

        await shakeApi.getSession(id)

        expect(lastCall().path).toBe(`/shake/sessions/${encodeURIComponent(id)}`)
    })

    it('404 SHAKE_SESSION_NOT_FOUND becomes an ApiError with status 404 and that code', async () => {
        mockServerFetch.mockResolvedValue(
            fakeResponse(404, { error: 'Session not found', code: 'SHAKE_SESSION_NOT_FOUND' })
        )

        const error = await rejection(shakeApi.getSession(SESSION.sessionId))

        expect(error).toBeInstanceOf(ApiError)
        expect(error).toMatchObject({ status: 404, code: 'SHAKE_SESSION_NOT_FOUND' })
    })

    it.each([400, 401, 429, 500, 503])('%i becomes an ApiError with that status', async (status) => {
        mockServerFetch.mockResolvedValue(fakeResponse(status, { error: 'nope', code: 'X' }))

        const error = await rejection(shakeApi.getSession(SESSION.sessionId))

        expect(error).toBeInstanceOf(ApiError)
        expect((error as ApiError).status).toBe(status)
    })

    it('429 carries retryAfterSec', async () => {
        mockServerFetch.mockResolvedValue(fakeResponse(429, { error: 'slow down', retryAfterSeconds: 9 }))

        const error = (await rejection(shakeApi.getSession(SESSION.sessionId))) as ApiError

        expect(error.retryAfterSec).toBe(9)
    })

    it('a non-JSON error body still throws an ApiError', async () => {
        mockServerFetch.mockResolvedValue(fakeResponse(502, undefined, { raw: '<html>Bad gateway</html>' }))

        const error = (await rejection(shakeApi.getSession(SESSION.sessionId))) as ApiError

        expect(error).toBeInstanceOf(ApiError)
        expect(error.status).toBe(502)
    })

    it('lets a network failure surface as a rejection', async () => {
        mockServerFetch.mockRejectedValue(new TypeError('Load failed'))

        await expect(shakeApi.getSession(SESSION.sessionId)).rejects.toBeInstanceOf(Error)
    })
})

describe('shakeApi.cancelSession', () => {
    it('DELETEs /shake/sessions/<id>', async () => {
        mockServerFetch.mockResolvedValue(fakeResponse(204))

        await shakeApi.cancelSession(SESSION.sessionId)

        expect(mockServerFetch).toHaveBeenCalledTimes(1)
        expect(lastCall().path).toBe(`/shake/sessions/${SESSION.sessionId}`)
        expect(lastCall().init?.method).toBe('DELETE')
        expect(lastCall().init?.includeAuth).not.toBe(false)
    })

    it.each([['a/b c?d#e%'], ['../admin'], ['x?sessionId=other']])('URI-encodes the id (%s)', async (id) => {
        mockServerFetch.mockResolvedValue(fakeResponse(204))

        await shakeApi.cancelSession(id)

        expect(lastCall().path).toBe(`/shake/sessions/${encodeURIComponent(id)}`)
    })

    it('resolves with nothing on 204 (no body to parse)', async () => {
        mockServerFetch.mockResolvedValue(fakeResponse(204))

        await expect(shakeApi.cancelSession(SESSION.sessionId)).resolves.toBeUndefined()
    })

    it('resolves on 404: the session is already gone, which is what cancelling wanted', async () => {
        mockServerFetch.mockResolvedValue(
            fakeResponse(404, { error: 'Session not found', code: 'SHAKE_SESSION_NOT_FOUND' })
        )

        await expect(shakeApi.cancelSession(SESSION.sessionId)).resolves.toBeUndefined()
    })

    it('resolves on 404 even when the body is not JSON', async () => {
        mockServerFetch.mockResolvedValue(fakeResponse(404, undefined, { raw: '<html>Not Found</html>' }))

        await expect(shakeApi.cancelSession(SESSION.sessionId)).resolves.toBeUndefined()
    })

    it('throws an ApiError on 500', async () => {
        mockServerFetch.mockResolvedValue(fakeResponse(500, { error: 'boom', code: 'INTERNAL' }))

        const error = await rejection(shakeApi.cancelSession(SESSION.sessionId))

        expect(error).toBeInstanceOf(ApiError)
        expect(error).toMatchObject({ status: 500, code: 'INTERNAL' })
    })

    it.each([400, 401, 403, 429, 502, 503])('throws an ApiError on %i', async (status) => {
        mockServerFetch.mockResolvedValue(fakeResponse(status, { error: 'nope' }))

        const error = await rejection(shakeApi.cancelSession(SESSION.sessionId))

        expect(error).toBeInstanceOf(ApiError)
        expect((error as ApiError).status).toBe(status)
    })

    it('throws an ApiError on a 500 with a non-JSON body', async () => {
        mockServerFetch.mockResolvedValue(fakeResponse(500, undefined, { raw: 'upstream error' }))

        const error = await rejection(shakeApi.cancelSession(SESSION.sessionId))

        expect(error).toBeInstanceOf(ApiError)
        expect((error as ApiError).status).toBe(500)
    })

    it('does not retry on its own', async () => {
        mockServerFetch.mockResolvedValue(fakeResponse(500, { error: 'boom' }))

        await rejection(shakeApi.cancelSession(SESSION.sessionId))

        expect(mockServerFetch).toHaveBeenCalledTimes(1)
    })
})
