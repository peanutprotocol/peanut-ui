import { nativeErrorCode, nativePasskeyFailure } from '../native-passkey-errors'
import { classifyPasskeyError, getPasskeyErrorSetupKey } from '../webauthn.utils'
import { friendlyError } from '../friendly-error.utils'
import { loadMessages } from '@/i18n/app/messages'

const PREFIX = 'The operation couldn’t be completed. '
const CASES = [
    [
        'Unable to verify webcredentials association of TEAM.example with domain peanut.me. Please try again in a few seconds.',
        'association_unavailable',
        'PASSKEY_ASSOCIATION_UNAVAILABLE',
        'associationUnavailable',
        'passkeyAssociationUnavailable',
    ],
    [
        'Application with identifier TEAM.example is not associated with domain peanut.me',
        'association_mismatch',
        'PASSKEY_ORIGIN',
        'origin',
        'passkeyAssociationMismatch',
    ],
    [
        'Device must be unlocked to perform request.',
        'device_locked',
        'PASSKEY_DEVICE_LOCKED',
        'deviceLocked',
        'passkeyDeviceLocked',
    ],
    [
        'Stolen Device Protection is enabled and biometry is required.',
        'biometry_required',
        'PASSKEY_BIOMETRY_REQUIRED',
        'biometryRequired',
        'passkeyBiometryRequired',
    ],
] as const

it.each(CASES)('classifies %s before the generic NotAllowedError', (message, reason, code, key, displayCode) => {
    const error = Object.assign(new Error(PREFIX + message), { name: 'NotAllowedError' })
    expect(nativePasskeyFailure(error)).toBe(reason)
    expect(classifyPasskeyError(error).code).toBe(code)
    const wrapped = Object.assign(new Error('curated'), { name: 'PasskeyError', code })
    expect(getPasskeyErrorSetupKey(wrapped)).toBe(`passkey.${key}`)
    expect(friendlyError(error)).toEqual({ kind: 'code', code: displayCode })
    expect(friendlyError(new Error('SDK wrapper', { cause: error }))).toEqual({ kind: 'code', code: displayCode })
})

it('does not label camera or clipboard permission denial as a native passkey failure', () => {
    const error = new DOMException('Permission denied', 'NotAllowedError')
    expect(nativePasskeyFailure(error)).toBeUndefined()
    expect(friendlyError(error)).toEqual({ kind: 'code', code: 'genericSupport' })
})

it.each([
    '(com.apple.AuthenticationServices.AuthorizationError error 1001.)',
    'User cancelled the selector',
    '[16] Cancelled by user.',
])('offers neutral signing recovery for explicit cancellation: %s', (message) => {
    expect(nativePasskeyFailure(message)).toBe('canceled')
    expect(friendlyError(new Error(message))).toEqual({ kind: 'code', code: 'passkeyVerificationIncomplete' })
})

it.each(['en', 'es-419', 'es-AR', 'pt-BR'] as const)(
    'provides recovery copy in the resolved %s catalog',
    async (locale) => {
        const messages = await loadMessages(locale)
        const english = await loadMessages('en')
        for (const [, , , key, displayCode] of CASES) {
            const copy = messages.setup.passkey[key]
            expect(copy).toBeTruthy()
            expect(messages.errors[displayCode]).toBe(copy)
            if (locale !== 'en') expect(copy).not.toBe(english.setup.passkey[key])
        }
        expect(messages.setup.passkey.notCompleted).not.toMatch(/create a wallet|crear una|criar uma/i)
        expect(messages.errors.passkeyVerificationIncomplete).toBe(messages.setup.passkey.notCompleted)
    }
)

describe('nativeErrorCode', () => {
    it.each([
        [PREFIX + '(com.apple.AuthenticationServices.AuthorizationError error 1001.)', 'AuthorizationError:1001'],
        [PREFIX + '(AuthenticationServicesCore.ASCABLEClient.ClientError error 4.)', 'ClientError:4'],
        ['[16] Cancelled by user.', 'android:16'],
        ['[50162] Unsuccessful result from folsom activity.', 'android:50162'],
    ])('reads the platform code from %s', (message, code) => {
        expect(nativeErrorCode(Object.assign(new Error(message), { name: 'NotAllowedError' }))).toBe(code)
    })

    it.each([
        PREFIX + 'Device must be unlocked to perform request.',
        'Couldn’t communicate with a helper application.',
        '',
    ])('has no code for %p', (message) => {
        expect(nativeErrorCode(new Error(message))).toBeUndefined()
    })
})

// The messages below are verbatim from production (Sentry and the PostHog
// exception mirror, 30 days to 2026-10-28). Each used to fall through to the
// LOGIN_ERROR fallback, which wipes the session at login (TASK-24017).
describe('messages the plugin names UnknownError or NotAllowedError', () => {
    it.each([
        ['User canceled the request', 'canceled', 'LOGIN_CANCELED'],
        ['[16] Canceled on BiometricPromptFragment.', 'canceled', 'LOGIN_CANCELED'],
        ['Client call cancel', 'canceled', 'LOGIN_CANCELED'],
        ['Sign in canceled', 'canceled', 'LOGIN_CANCELED'],
        ['User verification is cancelled by the user.', 'canceled', 'LOGIN_CANCELED'],
        ['This request has been cancelled by the user.', 'canceled', 'LOGIN_CANCELED'],
        ['Passkey registration was cancelled.', 'canceled', 'LOGIN_CANCELED'],
        ['Passkey authentication was cancelled.', 'canceled', 'LOGIN_CANCELED'],
        ['No create options available.', 'setup_required', 'PASSKEY_UNSUPPORTED'],
        ['Screen lock is missing.', 'setup_required', 'PASSKEY_UNSUPPORTED'],
        [
            'createCredentialAsync no provider dependencies found - please ensure the desired provider dependencies are added',
            'setup_required',
            'PASSKEY_UNSUPPORTED',
        ],
        ['Unsuccessful result from folsom activity.', 'provider_failed', 'PASSKEY_INTERRUPTED'],
        ['[50162] Unsuccessful result from folsom activity.', 'provider_failed', 'PASSKEY_INTERRUPTED'],
        ['The UI was interrupted - please try again.', 'provider_failed', 'PASSKEY_INTERRUPTED'],
        ['[15] Flow has timed out.', 'provider_failed', 'PASSKEY_INTERRUPTED'],
        [
            PREFIX + '(AuthenticationServicesCore.ASCABLEClient.ClientError error 2.)',
            'provider_failed',
            'PASSKEY_INTERRUPTED',
        ],
        ['Couldn’t communicate with a helper application.', 'provider_failed', 'PASSKEY_INTERRUPTED'],
        ['[50156] Cannot find credential in local KeyStore or database.', 'credential_missing', 'PASSKEY_NOT_FOUND'],
    ] as const)('names %s', (message, reason, code) => {
        const error = new Error(message)
        expect(nativePasskeyFailure(error)).toBe(reason)
        expect(classifyPasskeyError(error).code).toBe(code)
        expect(friendlyError(error)).toEqual({
            kind: 'code',
            code: reason === 'canceled' ? 'passkeyVerificationIncomplete' : 'passkeyNotCompleted',
        })
    })

    it.each(['Passkey registration failed.', 'Passkey authentication failed.', 'Login not verified'])(
        'leaves %s without a native reason',
        (message) => {
            expect(nativePasskeyFailure(new Error(message))).toBeUndefined()
            expect(classifyPasskeyError(new Error(message)).code).toBe('LOGIN_ERROR')
        }
    )

    it.each([
        [
            'No se pudo completar la operación. (Error de com.apple.AuthenticationServices.AuthorizationError 1001)',
            'canceled',
            'AuthorizationError:1001',
        ],
        [
            'A operação não pôde ser concluída. (com.apple.AuthenticationServices.AuthorizationError erro 1001.)',
            'canceled',
            'AuthorizationError:1001',
        ],
        [
            'No se pudo completar la operación. (Error de com.apple.AuthenticationServices.AuthorizationError 1004)',
            'authorization_failed',
            'AuthorizationError:1004',
        ],
        [
            PREFIX + '(com.apple.AuthenticationServices.AuthorizationError error 1000.)',
            undefined,
            'AuthorizationError:1000',
        ],
    ])('reads the localised iOS sentence %s', (message, reason, code) => {
        expect(nativePasskeyFailure(message)).toBe(reason)
        expect(nativeErrorCode(message)).toBe(code)
    })
})
