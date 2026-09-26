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

import {
    initiateSumsubKyc,
    initiateSelfHealResubmission,
    startKycAction,
    isTerminalActionCode,
    restartIdentityVerification,
    startResidenceChangeVerification,
} from '@/app/actions/sumsub'
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

    it('never shows a 4xx developer string; userMessage still wins', async () => {
        respondWith(404, { error: 'No provider rejection found' })
        const result = await initiateSelfHealResubmission('BRIDGE')
        expect(result.error).not.toMatch(/no provider rejection found/i)
        expect(result.code).toBe('resubmit_failed')

        respondWith(400, { error: 'No identity verification found', userMessage: 'Start the ID check first.' })
        expect((await initiateSelfHealResubmission('BRIDGE')).error).toBe('Start the ID check first.')
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

    // The response is unvalidated JSON and the caller stores this in the ref
    // `refreshToken` replays to `initiateSumsubKyc` — so an unrecognised value
    // would not merely read as single-level, it would be sent BACK to the API on
    // the next refresh. Dropping it lets the caller keep the intent it had.
    it('drops an unrecognised resolved intent rather than storing it', async () => {
        mockFetch.mockResolvedValue({
            ok: true,
            json: async () => ({ token: 'tok', levelName: 'general', applicantId: 'app-1', regionIntent: 'ATLANTIS' }),
        } as unknown as Response)
        const result = await restartIdentityVerification()
        expect(result.data?.regionIntent).toBeUndefined()
        expect(result.data?.token).toBe('tok')
    })

    it('a backend that predates the field yields no intent, not a crash', async () => {
        mockFetch.mockResolvedValue(okResponse())
        const result = await restartIdentityVerification()
        expect(result.data?.regionIntent).toBeUndefined()
        expect(result.data?.levelName).toBe('general')
    })

    it('a refusal is still surfaced as an error', async () => {
        mockFetch.mockResolvedValue({
            ok: false,
            status: 403,
            json: async () => ({ error: 'restart_failed', userMessage: 'Cannot restart right now' }),
        } as unknown as Response)
        const result = await restartIdentityVerification()
        expect(result.data).toBeUndefined()
        expect(result.error).toBeTruthy()
    })
})

describe('restart cooldown details', () => {
    it('preserves the retry time on rate limits', async () => {
        respondWith(429, { error: 'Please wait', retryAt: '2026-09-08T18:57:00Z' })
        expect((await restartIdentityVerification()).cooldown).toEqual({ retryAt: '2026-09-08T18:57:00.000Z' })
    })
    it('does not mistake a state conflict for a cooldown', async () => {
        respondWith(409, { error: 'Verification changed, please retry' })
        expect((await restartIdentityVerification()).cooldown).toBeUndefined()
    })
    it('keeps rate limits dismissible when the retry time is invalid', async () => {
        respondWith(429, { error: 'Please wait', retryAt: 'invalid' })
        expect((await restartIdentityVerification()).cooldown).toEqual({ retryAt: undefined })
    })
})

it('uses Retry-After for infrastructure rate limits', async () => {
    mockFetch.mockResolvedValue({
        ok: false,
        status: 429,
        headers: new Headers({ 'Retry-After': 'Tue, 08 Sep 2026 18:57:00 GMT' }),
        json: async () => ({ error: 'Too many requests' }),
    } as Response)
    expect((await restartIdentityVerification()).cooldown?.retryAt).toBe('2026-09-08T18:57:00.000Z')
})

describe('startResidenceChangeVerification — wire shape', () => {
    it('uses the non-destructive residence endpoint and validates the action token', async () => {
        respondWith(200, {
            token: 'tok-residence',
            applicantId: 'app-1',
            levelName: 'peanut-residence-change',
            targetCountry: 'PT',
        })

        const result = await startResidenceChangeVerification('pt')

        expect(mockFetch).toHaveBeenCalledWith('/users/residence-change/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ targetCountry: 'PT' }),
        })
        expect(result.data?.targetCountry).toBe('PT')
        expect(result.data?.token).toBe('tok-residence')
    })

    it('never silently falls back to the identity-reset endpoint', async () => {
        respondWith(409, { error: 'Save a new residence before starting verification.' })

        const result = await startResidenceChangeVerification('PT')

        // a 4xx `error` is not user copy: the localized fallback shows instead
        expect(result.code).toBe('residence_change_failed')
        expect(mockFetch).toHaveBeenCalledTimes(1)
        expect(mockFetch).not.toHaveBeenCalledWith('/users/identity/restart', expect.anything())
    })

    it('preserves a residence-action retry window from a 409 response', async () => {
        const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-09-14T20:00:00.000Z'))
        try {
            respondWith(409, {
                error: 'Wait a few minutes before starting another residence verification.',
                retryAfterSeconds: 300,
            })

            const result = await startResidenceChangeVerification('PT')

            expect(result.cooldown).toEqual({ retryAt: '2026-09-14T20:05:00.000Z' })
        } finally {
            nowSpy.mockRestore()
        }
    })
})

describe('startKycAction — durable session contract', () => {
    const session = {
        id: 'session-1',
        generation: 3,
        targetCountry: 'BR',
        externalActionId: 'manteca-user-attempt-3-BR',
        state: 'SUBMISSION_PENDING',
        reasonCode: null,
        isMultiLevel: false,
    }
    it.each(['REVIEW_PENDING', 'SUBMISSION_PENDING', 'PROVIDER_PENDING', 'READY', 'CORRECTION_REQUIRED', 'BLOCKED'])(
        'keeps a %s response without a token',
        async (state) => {
            respondWith(200, {
                levelName: 'manteca-kyc',
                externalActionId: session.externalActionId,
                session: { ...session, state },
            })
            const result = await startKycAction('manteca-kyc-action:BR')
            expect(result.error).toBeUndefined()
            expect(result.data?.session).toEqual({ ...session, state })
            expect(result.data?.token).toBeUndefined()
        }
    )
    it('keeps generation ownership when collection returns a token', async () => {
        respondWith(200, {
            sumsubAccessToken: 'token',
            levelName: 'manteca-kyc',
            session: { ...session, state: 'COLLECTING' },
        })
        expect(await startKycAction('manteca-kyc-action:BR')).toMatchObject({
            data: { token: 'token', session: { id: 'session-1', generation: 3 } },
        })
    })
    it('still rejects a success response with neither a token nor a session', async () => {
        respondWith(200, { levelName: 'manteca-kyc' })
        expect((await startKycAction('manteca-kyc-action:BR')).code).toBe('invalid_response')
    })
})

// api#1738: resubmit refuses a residence the bank rails are closed to with a
// 403 carrying `code` + `userMessage`. It is permanent, and never read as prose.
describe('residence refusals (code field)', () => {
    it.each(['residence_bank_restricted', 'uk_resident_blocked'])(
        '%s on resubmit is terminal and keeps the user message',
        async (code) => {
            respondWith(403, {
                error: 'Bank transfers are not available for your current or pending residence.',
                code,
                userMessage: 'Bank transfers are not available for your current or pending residence.',
            })

            const result = await initiateSelfHealResubmission('BRIDGE')

            expect(result.code).toBe(code)
            expect(isTerminalActionCode(result.code)).toBe(true)
            expect(result.error).toMatch(/not available for your current or pending residence/)
        }
    )
})
