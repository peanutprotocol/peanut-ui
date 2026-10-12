import { nativePasskeyFailure } from '../native-passkey-errors'
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
