/**
 * Wire-level tests for `restartIdentityVerification`.
 *
 * Asserted against the REQUEST and the RESPONSE BODY rather than a mocked
 * return value, because both defects this covers live in that translation:
 *
 *  - the request must carry a JSON body (the backend's schema rejects a POST
 *    with no `Content-Type`), and must forward only intents the route accepts,
 *    since a server action is a public endpoint;
 *  - the response is unvalidated JSON, and its `regionIntent` is stored in the
 *    ref that `refreshToken` later replays to `initiateSumsubKyc` — so an
 *    unrecognised value would not merely read as single-level, it would be sent
 *    back to the API on the next refresh.
 */

import { restartIdentityVerification } from '@/app/actions/sumsub'
import { serverFetch } from '@/utils/api-fetch'

jest.mock('@/utils/api-fetch', () => ({ serverFetch: jest.fn() }))

const mockFetch = serverFetch as jest.MockedFunction<typeof serverFetch>

const respondWith = (body: unknown, status = 200) => {
    mockFetch.mockResolvedValue({
        ok: status >= 200 && status < 300,
        status,
        json: async () => body,
    } as unknown as Response)
}

const requestBody = () => JSON.parse((mockFetch.mock.calls[0][1] as { body: string }).body)

beforeEach(() => mockFetch.mockReset())

describe('restartIdentityVerification — request', () => {
    const ok = { token: 'tok', levelName: 'general', applicantId: 'app_1' }

    it('always sends a JSON body, so the route schema does not reject it', async () => {
        respondWith(ok)

        await restartIdentityVerification()

        const init = mockFetch.mock.calls[0][1] as { method: string; headers: Record<string, string>; body: string }
        expect(init.method).toBe('POST')
        expect(init.headers['Content-Type']).toBe('application/json')
        expect(requestBody()).toEqual({})
    })

    it('forwards a supported intent', async () => {
        respondWith(ok)

        await restartIdentityVerification('LATAM')

        expect(requestBody()).toEqual({ regionIntent: 'LATAM' })
    })

    it('drops an unsupported intent rather than forwarding it', async () => {
        respondWith(ok)

        await restartIdentityVerification('MARS' as never)

        expect(requestBody()).toEqual({})
    })
})

describe('restartIdentityVerification — response', () => {
    it('preserves a server-resolved intent', async () => {
        respondWith({ token: 'tok', levelName: 'general', applicantId: 'app_1', regionIntent: 'LATAM' })

        const result = await restartIdentityVerification()

        expect(result.data?.regionIntent).toBe('LATAM')
        expect(result.data?.levelName).toBe('general')
    })

    // The caller stores this in the ref `refreshToken` replays to the API, so an
    // unrecognised value must not survive the boundary. Dropping it lets the
    // caller's `??` fall back to the intent it already had.
    it('drops an unrecognised intent so the caller falls back to its own', async () => {
        respondWith({ token: 'tok', levelName: 'general', applicantId: 'app_1', regionIntent: 'ATLANTIS' })

        const result = await restartIdentityVerification()

        expect(result.data?.regionIntent).toBeUndefined()
        expect(result.data?.token).toBe('tok')
    })

    it('a backend that predates the field yields no intent, not a crash', async () => {
        respondWith({ token: 'tok', levelName: 'general', applicantId: 'app_1' })

        const result = await restartIdentityVerification()

        expect(result.data?.regionIntent).toBeUndefined()
    })

    it('a refusal is still surfaced as an error', async () => {
        respondWith({ error: 'restart_failed', userMessage: 'Cannot restart right now' }, 403)

        const result = await restartIdentityVerification()

        expect(result.data).toBeUndefined()
        expect(result.error).toBeTruthy()
    })
})
