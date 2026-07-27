import * as Sentry from '@sentry/nextjs'
import { RETRY_STRATEGIES } from '../retry.utils'
import {
    CLIENT_FETCH_TIMEOUT_MS,
    SERVER_FETCH_TIMEOUT_MS,
    fetchWithSentry,
    resolveDefaultTimeoutMs,
    sanitizeRequestBody,
    sanitizeResponseBody,
    scrubObject,
} from '../sentry.utils'

jest.mock('@sentry/nextjs', () => ({
    withScope: jest.fn((cb: (scope: unknown) => void) => cb({ setFingerprint: jest.fn(), setTag: jest.fn() })),
    captureMessage: jest.fn(),
    captureException: jest.fn(),
}))

jest.mock('../connectivity', () => ({
    reportNetworkError: jest.fn(),
    reportNetworkOk: jest.fn(),
}))

describe('fetchWithSentry — expected-response suppression', () => {
    const mockResponse = (status: number, body: unknown): Response =>
        ({
            ok: status >= 200 && status < 300,
            status,
            clone: () => ({
                json: () => Promise.resolve(body),
                text: () => Promise.resolve(JSON.stringify(body)),
            }),
        }) as unknown as Response

    let warnSpy: jest.SpyInstance

    beforeEach(() => {
        jest.clearAllMocks()
        warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
    })

    afterEach(() => {
        warnSpy.mockRestore()
    })

    // Pins the fix for PEANUT-UI-QDR: a 400 from /invites/validate means the
    // user typed an invalid invite code during onboarding — expected input
    // validation surfaced inline, not a bug. Must never reach Sentry.
    it('does NOT report /invites/validate 400 (invalid invite code is expected user input)', async () => {
        global.fetch = jest.fn().mockResolvedValue(mockResponse(400, { error: 'Invalid Invite' }))

        const res = await fetchWithSentry('https://api.peanut.me/invites/validate', {
            method: 'POST',
            body: JSON.stringify({ inviteCode: 'nosuchuser' }),
        })

        expect(res.status).toBe(400)
        expect(Sentry.captureMessage).not.toHaveBeenCalled()
        expect(warnSpy).not.toHaveBeenCalled()
    })

    it('still reports /invites/validate 500 (real server failure)', async () => {
        global.fetch = jest.fn().mockResolvedValue(mockResponse(500, { error: 'boom' }))

        await fetchWithSentry('https://api.peanut.me/invites/validate', { method: 'POST', body: '{}' })

        expect(Sentry.captureMessage).toHaveBeenCalledWith(
            'POST to https://api.peanut.me/invites/validate failed with status 500',
            expect.objectContaining({ level: 'error' })
        )
    })

    it('still reports 400s from endpoints without a skip rule', async () => {
        global.fetch = jest.fn().mockResolvedValue(mockResponse(400, { error: 'bad request' }))

        await fetchWithSentry('https://api.peanut.me/some/endpoint', { method: 'POST', body: '{}' })

        expect(Sentry.captureMessage).toHaveBeenCalledWith(
            'POST to https://api.peanut.me/some/endpoint failed with status 400',
            expect.objectContaining({ level: 'warning' })
        )
    })
})

describe('sanitizeRequestBody', () => {
    it('redacts the PIN-set endpoint body wholesale (sensitive URL)', () => {
        const body = JSON.stringify({ pin: '1234' })
        expect(sanitizeRequestBody('https://api.peanut.me/rain/cards/abc-123/pin', body)).toBe(
            '[REDACTED: sensitive endpoint]'
        )
    })

    it('redacts regardless of cardId shape', () => {
        const body = JSON.stringify({ pin: '0000' })
        expect(sanitizeRequestBody('/rain/cards/00000000-0000-0000-0000-000000000000/pin', body)).toBe(
            '[REDACTED: sensitive endpoint]'
        )
    })

    it('key-scrubs non-sensitive URL bodies (preserves shape, redacts PII keys)', () => {
        const body = JSON.stringify({ amount: 1000, firstName: 'Hugo' })
        const out = sanitizeRequestBody('https://api.peanut.me/rain/cards/abc-123/withdraw/submit', body) as string
        const parsed = JSON.parse(out)
        expect(parsed.amount).toBe(1000)
        expect(parsed.firstName).toBe('[REDACTED]')
    })

    it('returns null for null/undefined bodies', () => {
        expect(sanitizeRequestBody('/rain/cards/abc-123/pin', null)).toBeNull()
        expect(sanitizeRequestBody('/rain/cards/abc-123/pin', undefined)).toBeNull()
    })

    it('does not over-match — /pin must be a path segment, not a substring', () => {
        const body = JSON.stringify({ thing: 'pin-pad' })
        expect(sanitizeRequestBody('/rain/cards/abc-123/pinpad-config', body)).toBe(body)
    })

    it('wholesale-redacts send-link password endpoints', () => {
        const body = JSON.stringify({ password: 'hunter2' })
        expect(sanitizeRequestBody('/api/send-link/create', body)).toBe('[REDACTED: sensitive endpoint]')
        expect(sanitizeRequestBody('/api/send-link/verify-password', body)).toBe('[REDACTED: sensitive endpoint]')
    })

    it('wholesale-redacts auth endpoints', () => {
        const body = JSON.stringify({ email: 'x@example.com', password: 'hunter2' })
        expect(sanitizeRequestBody('/api/login', body)).toBe('[REDACTED: sensitive endpoint]')
        expect(sanitizeRequestBody('/api/signup', body)).toBe('[REDACTED: sensitive endpoint]')
    })

    it('wholesale-redacts KYC endpoints', () => {
        const body = JSON.stringify({ firstName: 'Hugo', dni: '12345678' })
        expect(sanitizeRequestBody('/api/kyc/start', body)).toBe('[REDACTED: sensitive endpoint]')
        expect(sanitizeRequestBody('/api/bridge/customers', body)).toBe('[REDACTED: sensitive endpoint]')
    })
})

describe('sanitizeResponseBody', () => {
    it('wholesale-redacts sensitive URL responses', () => {
        expect(sanitizeResponseBody('/api/rain/cards/abc/pin', { ok: false })).toBe('[REDACTED: sensitive endpoint]')
    })

    it('key-scrubs non-sensitive URL responses (preserves shape, redacts PII keys)', () => {
        const out = sanitizeResponseBody('/api/users/me', {
            user: { email: 'hugo@peanut.me', firstName: 'Hugo', userId: 'u-1' },
        }) as { user: { email: string; firstName: string; userId: string } }
        expect(out.user.email).toBe('hugo@peanut.me')
        expect(out.user.userId).toBe('u-1')
        expect(out.user.firstName).toBe('[REDACTED]')
    })
})

describe('scrubObject — exact-match contract', () => {
    it('identity fields stay unredacted (already in PostHog)', () => {
        const result = scrubObject({
            userId: 'u-1',
            username: 'hugo',
            email: 'hugo@peanut.me',
            inviteCode: 'PEANUT42',
        }) as Record<string, string>
        expect(result.userId).toBe('u-1')
        expect(result.username).toBe('hugo')
        expect(result.email).toBe('hugo@peanut.me')
        expect(result.inviteCode).toBe('PEANUT42')
    })

    it('CRITICAL: onchain addresses stay visible (debugging onchain flows)', () => {
        // If this test fails, someone substring-matched on `address` and broke
        // debugging for every onchain flow in the app.
        const result = scrubObject({
            address: '0xabc',
            walletAddress: '0xdef',
            recipientAddress: '0x123',
            payerAddress: '0x456',
            depositAddress: '0x789',
            destinationAddress: 'TCNRtkx',
            sdaAddress: '0xsda',
            tokenAddress: '0xtoken',
            contractAddress: '0xcontract',
        }) as Record<string, string>
        expect(result.address).toBe('0xabc')
        expect(result.walletAddress).toBe('0xdef')
        expect(result.recipientAddress).toBe('0x123')
        expect(result.payerAddress).toBe('0x456')
        expect(result.depositAddress).toBe('0x789')
        expect(result.destinationAddress).toBe('TCNRtkx')
        expect(result.sdaAddress).toBe('0xsda')
        expect(result.tokenAddress).toBe('0xtoken')
        expect(result.contractAddress).toBe('0xcontract')
    })

    it('PII names get redacted (English + Bridge customer_* + Manteca Spanish)', () => {
        const result = scrubObject({
            firstName: 'Hugo',
            lastName: 'Monte',
            customerFirstName: 'Hugo',
            customerLastName: 'Monte',
            nombre: 'Hugo',
            apellido: 'Monte',
        }) as Record<string, string>
        Object.values(result).forEach((v) => expect(v).toBe('[REDACTED]'))
    })

    it('home address variants redacted; crypto addresses NOT', () => {
        const result = scrubObject({
            billingAddress: 'X',
            mailingAddress: 'X',
            homeAddress: 'X',
            street_line_1: 'X',
            direccion: 'X',
            walletAddress: '0xstay',
        }) as Record<string, string>
        expect(result.billingAddress).toBe('[REDACTED]')
        expect(result.mailingAddress).toBe('[REDACTED]')
        expect(result.homeAddress).toBe('[REDACTED]')
        expect(result.street_line_1).toBe('[REDACTED]')
        expect(result.direccion).toBe('[REDACTED]')
        expect(result.walletAddress).toBe('0xstay')
    })

    it('card data', () => {
        const result = scrubObject({
            pan: '4111',
            cvv: '123',
            cardPin: '1234',
            pin: '1234',
            expiryMonth: 12,
            cardholderName: 'Hugo',
        }) as Record<string, string>
        Object.values(result).forEach((v) => expect(v).toBe('[REDACTED]'))
    })

    it('government IDs (English + Bridge long-form + Manteca)', () => {
        const result = scrubObject({
            ssn: '111',
            social_security_number: '111',
            tax_identification_number: 'X',
            government_id_number: 'Z',
            dni: '12345678',
            documento: '12345678',
        }) as Record<string, string>
        Object.values(result).forEach((v) => expect(v).toBe('[REDACTED]'))
    })

    it('bank accounts', () => {
        const result = scrubObject({
            iban: 'ES12',
            cbu: '0123',
            clabe: '012345',
            routingNumber: '021000021',
            accountNumber: '9876',
        }) as Record<string, string>
        Object.values(result).forEach((v) => expect(v).toBe('[REDACTED]'))
    })

    it('handles arrays + nested objects', () => {
        const result = scrubObject({
            items: [{ pan: '4111' }],
            nested: { profile: { firstName: 'Hugo', userId: 'u-1' } },
        }) as { items: Array<{ pan: string }>; nested: { profile: { firstName: string; userId: string } } }
        expect(result.items[0].pan).toBe('[REDACTED]')
        expect(result.nested.profile.firstName).toBe('[REDACTED]')
        expect(result.nested.profile.userId).toBe('u-1')
    })

    it('depth-caps to defend against cycles (no throw)', () => {
        const cyclic: Record<string, unknown> = { name: 'root' }
        cyclic.self = cyclic
        expect(() => scrubObject(cyclic)).not.toThrow()
    })

    it('PROTO-POLLUTION DEFENSE: __proto__ / constructor / prototype dropped (CodeQL)', () => {
        // JSON.parse creates __proto__ as an OWN property. Without the
        // defense, scrubObject's `out[key] = …` walks into prototype
        // pollution. Pinned because CodeQL flagged the equivalent shape.
        const malicious = JSON.parse('{"__proto__":{"polluted":true},"constructor":"x","prototype":"y","clean":"z"}')
        const out = scrubObject(malicious) as Record<string, unknown>
        expect(Object.prototype.hasOwnProperty.call(out, '__proto__')).toBe(false)
        expect(Object.prototype.hasOwnProperty.call(out, 'constructor')).toBe(false)
        expect(Object.prototype.hasOwnProperty.call(out, 'prototype')).toBe(false)
        expect(out.clean).toBe('z')
        // Global Object.prototype must NOT have been mutated
        expect(({} as Record<string, unknown>).polluted).toBeUndefined()
    })
})

describe('fetch timeout budgets', () => {
    // `resolveDefaultTimeoutMs`'s default parameter reads the real process.env,
    // so a shell or CI runner that exports NEXT_PUBLIC_FETCH_TIMEOUT_MS would
    // otherwise fail this suite for reasons unrelated to the code under test.
    const realOverride = process.env.NEXT_PUBLIC_FETCH_TIMEOUT_MS
    beforeAll(() => {
        delete process.env.NEXT_PUBLIC_FETCH_TIMEOUT_MS
    })
    afterAll(() => {
        if (realOverride !== undefined) process.env.NEXT_PUBLIC_FETCH_TIMEOUT_MS = realOverride
    })

    describe('resolveDefaultTimeoutMs', () => {
        // Both branches, explicitly. An inverted check is the failure mode that
        // actually bites: hand the server the long budget and a Vercel function
        // hangs past its ceiling, producing exactly the opaque 504s the original
        // 10s existed to prevent.
        it('uses the client budget in a browser, the server budget in a function', () => {
            expect(resolveDefaultTimeoutMs(false, undefined)).toBe(CLIENT_FETCH_TIMEOUT_MS)
            expect(resolveDefaultTimeoutMs(true, undefined)).toBe(SERVER_FETCH_TIMEOUT_MS)
        })

        // Regression pin: 10s was smaller than a page load in high-latency
        // markets, aborting healthy browser requests. Don't go back there.
        // (The server budget deliberately stays at 10s — see sentry.utils.ts.)
        it('keeps the client budget clear of the 10s that caused false timeouts', () => {
            expect(CLIENT_FETCH_TIMEOUT_MS).toBeGreaterThan(10_000)
        })

        it('lets NEXT_PUBLIC_FETCH_TIMEOUT_MS override both contexts', () => {
            expect(resolveDefaultTimeoutMs(false, '45000')).toBe(45_000)
            expect(resolveDefaultTimeoutMs(true, '45000')).toBe(45_000)
        })

        // parseInt would have read "30s" as 30ms and "0" as 0 — both abort every
        // request instantly. A malformed override must fall back, not brick fetches.
        it.each([undefined, '', 'not-a-number', '30s', '0.5', '0', '-1', 'Infinity'])(
            'falls back to the context default for a malformed override: %p',
            (override) => {
                expect(resolveDefaultTimeoutMs(false, override)).toBe(CLIENT_FETCH_TIMEOUT_MS)
                expect(resolveDefaultTimeoutMs(true, override)).toBe(SERVER_FETCH_TIMEOUT_MS)
            }
        )
    })

    // The client budget is per ATTEMPT, and React Query retries on top, so the
    // real wait is timeout x attempts + backoff. Pinned here because the
    // multiplier lives in another file: bump RETRY_STRATEGIES.FAST or the budget
    // far enough and this fails instead of silently shipping a long spinner.
    // Bounds the DEFAULT strategy only — queries that set their own `retry`
    // (e.g. Claim.tsx) are not covered by this.
    it('keeps the worst case under 70s for the default retry strategy', () => {
        const { retry, retryDelay } = RETRY_STRATEGIES.FAST
        const attempts = retry + 1
        const backoff = Array.from({ length: retry }, (_, i) => retryDelay(i)).reduce((a, b) => a + b, 0)

        const worstCaseMs = attempts * CLIENT_FETCH_TIMEOUT_MS + backoff

        expect(worstCaseMs).toBe(63_000)
        expect(worstCaseMs).toBeLessThan(70_000)
    })

    describe('fetchWithSentry timeout resolution', () => {
        const abort = () => {
            const error = new Error('aborted')
            error.name = 'AbortError'
            return error
        }
        let infoSpy: jest.SpyInstance

        beforeEach(() => {
            jest.clearAllMocks()
            infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {})
        })

        afterEach(() => infoSpy.mockRestore())

        const reportedTimeoutMs = () =>
            (Sentry.captureException as jest.Mock).mock.calls[0][1].extra.timeoutMs as number

        // Re-imported with the env cleared: the module captures its default at
        // LOAD time, so the surrounding beforeAll can't reach it and an ambient
        // NEXT_PUBLIC_FETCH_TIMEOUT_MS would otherwise fail this for the wrong reason.
        it('defaults to the client budget under a browser global', async () => {
            let freshFetchWithSentry!: typeof fetchWithSentry
            jest.isolateModules(() => {
                freshFetchWithSentry = require('../sentry.utils').fetchWithSentry
            })

            global.fetch = jest.fn().mockRejectedValue(abort())
            await expect(freshFetchWithSentry('https://api.peanut.me/users/me')).rejects.toThrow(
                'Service temporarily unavailable. Please try again.'
            )
            expect(reportedTimeoutMs()).toBe(CLIENT_FETCH_TIMEOUT_MS)
        })

        it('still lets a per-call timeoutMs win over the default', async () => {
            global.fetch = jest.fn().mockRejectedValue(abort())
            await expect(fetchWithSentry('https://api.peanut.me/users/me', {}, 1234)).rejects.toThrow(
                'Service temporarily unavailable. Please try again.'
            )
            expect(reportedTimeoutMs()).toBe(1234)
        })
    })
})
