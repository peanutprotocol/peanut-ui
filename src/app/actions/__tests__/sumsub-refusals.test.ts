/**
 * Wire-level tests for how a backend refusal becomes a client-side result.
 *
 * These assert against the RESPONSE BODY, not against a mocked return value of
 * `initiateSumsubKyc`. That distinction is the point: the two failure modes
 * below both live in the translation from body to result, so a test that mocks
 * the action away cannot see either of them.
 *
 * The backend's `error` field is overloaded — a machine code on these routes,
 * human prose on older ones — while `userMessage` is always prose. Getting
 * that wrong either shows a raw code to the user or silently loses the
 * terminal classification and restores a futile retry.
 */

import { initiateSumsubKyc, isTerminalActionCode, restartIdentityVerification } from '@/app/actions/sumsub'
import { serverFetch } from '@/utils/api-fetch'

jest.mock('@/utils/api-fetch', () => ({ serverFetch: jest.fn() }))

const mockFetch = serverFetch as jest.MockedFunction<typeof serverFetch>

const respondWith = (status: number, body: unknown) => {
    mockFetch.mockResolvedValue({
        ok: status >= 200 && status < 300,
        status,
        json: async () => body,
    } as unknown as Response)
}

beforeEach(() => mockFetch.mockReset())

describe('initiateSumsubKyc — backend refusals', () => {
    it('classifies a permanent Manteca nationality refusal as terminal AND keeps its message', () => {
        return (async () => {
            respondWith(400, {
                error: 'manteca_us_nationality_restricted',
                userMessage: 'Payments from this country are not available for US citizens at this time.',
            })

            const result = await initiateSumsubKyc({ regionIntent: 'LATAM', crossRegion: true })

            expect(isTerminalActionCode(result.code)).toBe(true)
            expect(result.error).toMatch(/US citizens/i)
            // the machine code must never be the thing the user reads
            expect(result.error).not.toMatch(/manteca_us_nationality_restricted/)
        })()
    })

    it('never renders a bare machine code as prose when userMessage is absent', async () => {
        // The failure mode: `error` is truthy, so a naive `userMessage || error`
        // treats the code itself as the display string.
        respondWith(400, { error: 'target_country_required' })

        const result = await initiateSumsubKyc({ regionIntent: 'LATAM', crossRegion: true })

        expect(isTerminalActionCode(result.code)).toBe(true)
        expect(result.error).not.toBe('target_country_required')
        expect(result.error).toBeTruthy()
    })

    it('keeps prose from older routes that put it in `error`, and leaves it retriable', async () => {
        respondWith(503, { error: 'We could not verify your eligibility right now. Please try again shortly.' })

        const result = await initiateSumsubKyc({ regionIntent: 'LATAM', crossRegion: true })

        expect(result.error).toMatch(/try again shortly/i)
        // a transient failure must NOT be classified terminal
        expect(isTerminalActionCode(result.code)).toBe(false)
    })

    it('falls back to canned copy with a code when the backend says nothing', async () => {
        respondWith(500, {})

        const result = await initiateSumsubKyc({ regionIntent: 'EU', crossRegion: true })

        expect(result.code).toBe('initiate_failed')
        expect(isTerminalActionCode(result.code)).toBe(false)
    })

    it('passes a successful body straight through', async () => {
        respondWith(200, { token: 'tok', applicantId: 'app_1', status: 'PENDING' })

        const result = await initiateSumsubKyc({ regionIntent: 'EU' })

        expect(result.data?.token).toBe('tok')
        expect(result.error).toBeUndefined()
    })
})

describe('restartIdentityVerification — wire shape', () => {
    const okResponse = () =>
        ({
            ok: true,
            json: async () => ({ token: 'tok', levelName: 'general', applicantId: 'app-1' }),
        }) as unknown as Response

    it('posts the region intent as JSON so the backend mints the matching level', async () => {
        mockFetch.mockResolvedValue(okResponse())
        const result = await restartIdentityVerification('LATAM')
        expect(mockFetch).toHaveBeenCalledWith(
            '/users/identity/restart',
            expect.objectContaining({
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ regionIntent: 'LATAM' }),
            })
        )
        expect(result.data?.token).toBe('tok')
    })

    it('sends an empty body without an intent, and drops one outside the known set', async () => {
        mockFetch.mockResolvedValue(okResponse())
        await restartIdentityVerification()
        expect(mockFetch).toHaveBeenLastCalledWith('/users/identity/restart', expect.objectContaining({ body: '{}' }))

        await restartIdentityVerification('BOGUS' as never)
        expect(mockFetch).toHaveBeenLastCalledWith('/users/identity/restart', expect.objectContaining({ body: '{}' }))
    })

    // The backend resolves the intent from the declared residence and can
    // overrule what we asked for, so the resolved value has to reach the caller.
    it('surfaces the intent the backend resolved, not the one we sent', async () => {
        mockFetch.mockResolvedValue({
            ok: true,
            json: async () => ({ token: 'tok', levelName: 'general', applicantId: 'app-1', regionIntent: 'LATAM' }),
        } as unknown as Response)
        const result = await restartIdentityVerification()
        expect(result.data?.regionIntent).toBe('LATAM')
    })
})
