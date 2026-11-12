jest.mock('@/utils/native-platform', () => require('@/test-utils/native-platform-mock').createNativePlatformMock())

import {
    installPasskeyVerifyCapture,
    PasskeyAccountDeletedError,
    PasskeyOptionsFailedError,
    PasskeyRateLimitedError,
    PasskeyVerifyRejectedError,
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
function jsonResponse(body: unknown, status = 200): Response {
    const response = {
        ok: status >= 200 && status < 300,
        status,
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

    it.each([
        '/passkeys/login/options',
        '/passkeys/login/verify',
        '/passkeys/register/options',
        '/passkeys/register/verify',
    ])('surfaces a 429 from %s as rate limited, not a server or login failure (TASK-22431)', async (path) => {
        mockUnderlyingFetch.mockResolvedValueOnce(jsonResponse({ error: 'An unexpected error occurred' }, 429))

        const pending = window.fetch(`https://api.peanut.me${path}`, { method: 'POST' })

        await expect(pending).rejects.toBeInstanceOf(PasskeyRateLimitedError)
        expect(stashCeremonyVerifyToken).not.toHaveBeenCalled()
    })

    it('passes successful options responses through', async () => {
        const response = jsonResponse({ challenge: 'abc' })
        mockUnderlyingFetch.mockResolvedValueOnce(response)

        await expect(window.fetch('/passkeys/login/options', { method: 'POST' })).resolves.toBe(response)
    })

    it('turns the API refusal of a passkey layout into the typed signup error (TASK-24498)', async () => {
        mockUnderlyingFetch.mockResolvedValueOnce(
            jsonResponse({ error: 'Unsupported passkey', code: 'PASSKEY_PROVIDER_UNSUPPORTED' }, 400)
        )

        await expect(window.fetch('/passkeys/register/verify', { method: 'POST' })).rejects.toMatchObject({
            name: 'PasskeyProviderUnsupportedError',
            code: 'PASSKEY_PROVIDER_UNSUPPORTED',
        })
    })

    it('leaves any other register/verify 400 to the existing classification', async () => {
        const response = jsonResponse({ error: 'Invalid userId' }, 400)
        mockUnderlyingFetch.mockResolvedValueOnce(response)

        await expect(window.fetch('/passkeys/register/verify', { method: 'POST' })).resolves.toBe(response)
    })

    it('preserves non-auth login failures for the existing server/network classification', async () => {
        const response = jsonResponse({ error: 'Login unavailable' }, 500)
        mockUnderlyingFetch.mockResolvedValueOnce(response)

        await expect(window.fetch('/passkeys/login/verify', { method: 'POST' })).resolves.toBe(response)
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
