import posthog from 'posthog-js'
import { capturePasskeySignFailure, classifyPasskeyError } from '../webauthn.utils'

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

    test('falls back to LOGIN_ERROR for unknown errors', () => {
        expect(classifyPasskeyError(new Error('mystery')).code).toBe('LOGIN_ERROR')
    })
})
