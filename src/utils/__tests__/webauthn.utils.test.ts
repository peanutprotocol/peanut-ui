import posthog from 'posthog-js'
import {
    capturePasskeySignFailure,
    classifyPasskeyError,
    getPasskeyErrorSetupKey,
    normalizePasskeyServerError,
} from '../webauthn.utils'

jest.mock('posthog-js', () => ({
    __esModule: true,
    default: { capture: jest.fn() },
}))

jest.mock('@sentry/nextjs', () => ({
    captureMessage: jest.fn(),
}))

describe('capturePasskeySignFailure', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    test('captures passkey_sign_failed for a WebAuthn DOMException name', () => {
        const webAuthnRefused = Object.assign(
            new Error('The request is not allowed by the user agent or the platform in the current context.'),
            { name: 'NotAllowedError' }
        )
        capturePasskeySignFailure(webAuthnRefused, 'send-user-op')
        expect(posthog.capture).toHaveBeenCalledWith('passkey_sign_failed', {
            error_name: 'NotAllowedError',
            context: 'send-user-op',
        })
    })

    test('ignores non-WebAuthn errors so signing catches can call it unconditionally', () => {
        // The signing catch blocks see every failure (insufficient funds,
        // bundler timeouts, …) — only WebAuthn ceremony errors may emit the
        // event, or the metric becomes generic failure noise.
        capturePasskeySignFailure(new Error('insufficient funds'), 'send-user-op')
        capturePasskeySignFailure('not even an Error', 'send-user-op')
        expect(posthog.capture).not.toHaveBeenCalled()
    })
})

describe('classifyPasskeyError', () => {
    test('maps iOS ASAuthorizationError 1004 (failed, e.g. no usable passkey) to LOGIN_CANCELED', () => {
        const err = new Error(
            'The operation couldn’t be completed. (com.apple.AuthenticationServices.AuthorizationError error 1004.)'
        )
        expect(classifyPasskeyError(err).code).toBe('LOGIN_CANCELED')
    })

    test('maps iOS ASAuthorizationError 1001 (user canceled) to LOGIN_CANCELED', () => {
        const err = new Error(
            'The operation couldn’t be completed. (com.apple.AuthenticationServices.AuthorizationError error 1001.)'
        )
        expect(classifyPasskeyError(err).code).toBe('LOGIN_CANCELED')
    })

    test('leaves other ASAuthorizationError codes as LOGIN_ERROR', () => {
        const err = new Error(
            'The operation couldn’t be completed. (com.apple.AuthenticationServices.AuthorizationError error 1002.)'
        )
        expect(classifyPasskeyError(err).code).toBe('LOGIN_ERROR')
    })

    test('still maps NotAllowedError DOMException name to LOGIN_CANCELED', () => {
        const err = Object.assign(new Error('not allowed'), { name: 'NotAllowedError' })
        expect(classifyPasskeyError(err).code).toBe('LOGIN_CANCELED')
    })

    test('maps WebKit "Load failed" fetch errors to NETWORK', () => {
        const err = Object.assign(new TypeError('Load failed'), { name: 'TypeError' })
        expect(classifyPasskeyError(err).code).toBe('NETWORK')
    })

    test('falls back to LOGIN_ERROR for unknown errors', () => {
        expect(classifyPasskeyError(new Error('mystery')).code).toBe('LOGIN_ERROR')
    })
})

describe('normalizePasskeyServerError', () => {
    // zerodev reads the passkey-server body with no status check, so a non-2xx
    // surfaces as one of these raw TypeErrors from inside the SDK. None of them
    // says anything about this device's passkey, so none may wipe the session.
    test.each([
        "undefined is not an object (evaluating 'e.replace')",
        'e.replace is not a function',
        "undefined is not an object (evaluating 't.replace')",
    ])('maps %s to a PasskeyServerError that classifies as NETWORK', (message) => {
        const raw = new TypeError(message)
        const normalized = normalizePasskeyServerError(raw)

        expect(normalized).toBeInstanceOf(Error)
        expect((normalized as Error).name).toBe('PasskeyServerError')
        expect((normalized as Error).cause).toBe(raw)
        expect(classifyPasskeyError(normalized).code).toBe('NETWORK')
    })

    // A rejected /login/verify is a real login failure (PEANUT-UI-R0V): it keeps
    // the LOGIN_ERROR path that clears stale auth state, just with a readable message.
    test.each([
        "undefined is not an object (evaluating 'loginVerifyResult.verification.verified')",
        "Cannot read properties of undefined (reading 'verified')",
    ])('maps %s to a plain "Login not verified" error that classifies as LOGIN_ERROR', (message) => {
        const normalized = normalizePasskeyServerError(new TypeError(message)) as Error
        expect(normalized.message).toBe('Login not verified')
        expect(classifyPasskeyError(normalized).code).toBe('LOGIN_ERROR')
    })

    test('leaves an unrelated TypeError alone so it still classifies as LOGIN_ERROR', () => {
        const raw = new TypeError('x is not a function')
        expect(normalizePasskeyServerError(raw)).toBe(raw)
        expect(classifyPasskeyError(raw).code).toBe('LOGIN_ERROR')
    })

    test('leaves non-TypeErrors alone even when the message mentions verification', () => {
        const raw = Object.assign(new Error('verification failed'), { name: 'NotAllowedError' })
        expect(normalizePasskeyServerError(raw)).toBe(raw)
        expect(normalizePasskeyServerError('not an error')).toBe('not an error')
    })
})

describe('getPasskeyErrorSetupKey', () => {
    const passkeyError = (code: string) =>
        Object.assign(new Error('curated english copy'), { name: 'PasskeyError', code })

    test('maps a known PasskeyError code to its translated setup.* catalog key', () => {
        expect(getPasskeyErrorSetupKey(passkeyError('LOGIN_CANCELED'))).toBe('waitlist.loginCanceled')
        expect(getPasskeyErrorSetupKey(passkeyError('CEREMONY_TIMEOUT'))).toBe('passkey.tookTooLong')
        expect(getPasskeyErrorSetupKey(passkeyError('PASSKEY_NOT_READY'))).toBe('passkey.notReady')
        expect(getPasskeyErrorSetupKey(passkeyError('PASSKEY_STATE'))).toBe('passkey.deviceState')
        expect(getPasskeyErrorSetupKey(passkeyError('PASSKEY_INTERRUPTED'))).toBe('passkey.interrupted')
        expect(getPasskeyErrorSetupKey(passkeyError('NETWORK'))).toBe('passkey.serverUnreachable')
    })

    test('returns undefined for codes without a translated equivalent (English fallback)', () => {
        expect(getPasskeyErrorSetupKey(passkeyError('LOGIN_ERROR'))).toBeUndefined()
    })

    test('returns undefined for non-PasskeyError failures and unknown codes', () => {
        expect(getPasskeyErrorSetupKey(new Error('boom'))).toBeUndefined()
        expect(getPasskeyErrorSetupKey(passkeyError('SOME_FUTURE_CODE'))).toBeUndefined()
        expect(getPasskeyErrorSetupKey(undefined)).toBeUndefined()
    })
})
