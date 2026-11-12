jest.mock('@/utils/native-platform', () => require('@/test-utils/native-platform-mock').createNativePlatformMock())

import {
    installPasskeyVerifyCapture,
    PasskeyAccountDeletedError,
    PasskeyOptionsFailedError,
    PasskeyVerifyRejectedError,
    getLoginRetryError,
} from '../passkey-auth-capture'
import { stashCeremonyStepUpToken, stashCeremonyVerifyToken } from '@/utils/passkeyCeremony.utils'
import { isCapacitor } from '@/utils/capacitor'

jest.mock('@/utils/capacitor', () => ({ isCapacitor: jest.fn(() => false) }))
jest.mock('@/utils/sentry-lazy', () => ({ withScope: jest.fn(), captureMessage: jest.fn(), addBreadcrumb: jest.fn() }))
jest.mock('@/utils/passkeyCeremony.utils', () => ({
    currentCeremonyId: () => 7,
    stashCeremonyVerifyToken: jest.fn(),
    stashCeremonyStepUpToken: jest.fn(),
}))

const mockIsCapacitor = isCapacitor as jest.Mock

// jsdom has no Response; the wrapper only touches ok/clone/json/text.
function jsonResponse(body: unknown, status = 200, retryAfter?: string): Response {
    const response = {
        ok: status >= 200 && status < 300,
        status,
        headers: new Headers(retryAfter ? { 'Retry-After': retryAfter } : {}),
        json: async () => body,
        text: async () => JSON.stringify(body),
        clone: () => response,
    }
    return response as unknown as Response
}

const mockUnderlyingFetch = jest.fn()

describe('installPasskeyVerifyCapture', () => {
    const verifyBody = { verification: { verified: true }, token: 'jwt', stepUpToken: 'proof', stepUpExpiresIn: 300 }

    beforeAll(() => {
        window.fetch = mockUnderlyingFetch
        installPasskeyVerifyCapture()
    })

    beforeEach(() => {
        jest.clearAllMocks()
        mockIsCapacitor.mockReturnValue(false)
        mockUnderlyingFetch.mockResolvedValue(jsonResponse(verifyBody))
    })

    it('web: stashes both proofs even when the browser does not accept the response cookie', async () => {
        await window.fetch('/passkeys/login/verify', { method: 'POST' })
        expect(stashCeremonyStepUpToken).toHaveBeenCalledWith('proof', 300, 7)
        expect(stashCeremonyVerifyToken).toHaveBeenCalledWith('jwt', 7)
    })

    it('native: stashes both', async () => {
        mockIsCapacitor.mockReturnValue(true)
        await window.fetch('https://api.peanut.me/passkeys/login/verify', { method: 'POST' })
        expect(stashCeremonyVerifyToken).toHaveBeenCalledWith('jwt', 7)
        expect(stashCeremonyStepUpToken).toHaveBeenCalledWith('proof', 300, 7)
    })

    it('ignores non-passkey requests', async () => {
        await window.fetch('/users/me')
        expect(stashCeremonyStepUpToken).not.toHaveBeenCalled()
    })

    it.each([400, 401])(
        'surfaces a rejected login assertion before ZeroDev decodes the %i body as a success',
        async (status) => {
            mockUnderlyingFetch.mockResolvedValueOnce(jsonResponse({ error: 'Rejected' }, status))

            await expect(window.fetch('/passkeys/login/verify', { method: 'POST' })).rejects.toMatchObject({
                name: 'PasskeyVerifyRejectedError',
                status,
            })
            expect(stashCeremonyVerifyToken).not.toHaveBeenCalled()
            expect(stashCeremonyStepUpToken).not.toHaveBeenCalled()
        }
    )

    it('surfaces a deleted account before ZeroDev decodes the 403 body as a success', async () => {
        mockUnderlyingFetch.mockResolvedValueOnce(jsonResponse({ error: 'ACCOUNT_DELETED' }, 403))

        const pending = window.fetch('/passkeys/login/verify', { method: 'POST' })

        await expect(pending).rejects.toBeInstanceOf(PasskeyAccountDeletedError)
        await expect(pending).rejects.not.toBeInstanceOf(PasskeyVerifyRejectedError)
        expect(stashCeremonyVerifyToken).not.toHaveBeenCalled()
        expect(stashCeremonyStepUpToken).not.toHaveBeenCalled()
    })

    it('leaves any other 403 from /login/verify to the existing classification', async () => {
        const response = jsonResponse({ error: 'Forbidden' }, 403)
        mockUnderlyingFetch.mockResolvedValueOnce(response)

        await expect(window.fetch('/passkeys/login/verify', { method: 'POST' })).resolves.toBe(response)
    })

    it.each(['login', 'register'])(
        'surfaces a 500 from /passkeys/%s/options before ZeroDev reads a missing challenge',
        async (flow) => {
            mockUnderlyingFetch.mockResolvedValueOnce(jsonResponse({ error: 'Internal Server Error' }, 500))

            const pending = window.fetch(`https://api.peanut.me/passkeys/${flow}/options`, { method: 'POST' })

            await expect(pending).rejects.toBeInstanceOf(PasskeyOptionsFailedError)
            await expect(pending).rejects.toMatchObject({ status: 500 })
        }
    )

    it('passes successful options responses through', async () => {
        const response = jsonResponse({ challenge: 'abc' })
        mockUnderlyingFetch.mockResolvedValueOnce(response)

        await expect(window.fetch('/passkeys/login/options', { method: 'POST' })).resolves.toBe(response)
    })

    it.each([429, 500, 502, 503, 504])(
        'types verify HTTP %s as a retryable failure without retrying',
        async (status) => {
            mockUnderlyingFetch.mockResolvedValueOnce(jsonResponse({ error: 'Login unavailable' }, status, '30'))
            await expect(window.fetch('/passkeys/login/verify', { method: 'POST' })).rejects.toMatchObject({
                status,
            })
            expect(mockUnderlyingFetch).toHaveBeenCalledTimes(1)
            expect(stashCeremonyVerifyToken).not.toHaveBeenCalled()
            expect(stashCeremonyStepUpToken).not.toHaveBeenCalled()
        }
    )

    it.each([
        '30',
        'Thu, 12 Nov 2026 14:00:30 GMT',
        'invalid',
        '-1',
        '99999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999',
    ])('honours Retry-After with a bounded parser and no immediate replay: %s', async (header) => {
        const now = Date.parse('2026-11-12T14:00:00Z')
        const clock = jest.spyOn(Date, 'now').mockReturnValue(now)
        try {
            mockUnderlyingFetch.mockResolvedValueOnce(jsonResponse({}, 429, header))
            await expect(window.fetch('/passkeys/login/verify')).rejects.toMatchObject({
                name: 'PasskeyVerifyRetryableError',
                status: 429,
            })
            const retry = getLoginRetryError()
            const expectedDelay = header === '30' || header.includes('GMT') ? 30000 : 1000
            expect(retry?.retryAt).toBe(now + expectedDelay)
            expect(mockUnderlyingFetch).toHaveBeenCalledTimes(1)
            clock.mockReturnValue(now + expectedDelay)
            expect(getLoginRetryError()).toBeUndefined()
        } finally {
            clock.mockRestore()
        }
    })
})

it.each(['options', 'verify'])(
    'preserves register/%s username conflicts before the SDK can decode an error body',
    async (step) => {
        mockUnderlyingFetch.mockResolvedValueOnce(
            jsonResponse({ error: 'Username already exists', code: 'USERNAME_TAKEN' }, 409)
        )
        await expect(window.fetch(`/passkeys/register/${step}`, { method: 'POST' })).rejects.toMatchObject({
            name: 'UsernameTaken',
        })
    }
)
