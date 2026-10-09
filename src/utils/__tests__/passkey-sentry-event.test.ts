import { beforeSendHandler } from '../../../sentry.utils'
import { withoutNoise } from '../sentry-posthog-mirror'
import type { ErrorEvent } from '@sentry/nextjs'

const biometric = 'The operation couldn’t be completed. Stolen Device Protection is enabled and biometry is required.'
const association =
    'The operation couldn’t be completed. Application with identifier TEAM.app is not associated with domain peanut.me'
const event = (value: string): ErrorEvent => ({ exception: { values: [{ type: 'NotAllowedError', value }] } })

it('keeps expected device requirements out of Sentry and the PostHog exception mirror', () => {
    const inner = jest.fn((e) => e)
    const mirror = withoutNoise({ processEvent: inner })
    const expected = event(biometric)
    expect(mirror.processEvent(expected)).toBe(expected)
    expect(inner).not.toHaveBeenCalled()
    expect(beforeSendHandler(expected)).toBeNull()
})

it('groups association failures consistently before either sink receives them', () => {
    const inner = jest.fn((e) => e)
    const e = event(association)
    withoutNoise({ processEvent: inner }).processEvent(e)
    expect(e.fingerprint).toEqual(['native-passkey-failure', 'association_mismatch'])
    expect(inner).toHaveBeenCalledWith(e)
    expect(beforeSendHandler(e)).toMatchObject({ level: 'error', tags: { passkey_reason: 'association_mismatch' } })
})

it('keeps a technical failure with a device-condition cause visible', () => {
    const e: ErrorEvent = {
        exception: {
            values: [
                { type: 'NotAllowedError', value: biometric },
                { type: 'SignatureVerificationError', value: 'Signature verification failed after submission' },
            ],
        },
        tags: { critical_flow: 'send' },
    }
    expect(beforeSendHandler(e)).not.toBeNull()
    const inner = jest.fn((value) => value)
    withoutNoise({ processEvent: inner }).processEvent(e)
    expect(inner).toHaveBeenCalledTimes(1)
    expect(e.fingerprint).toBeUndefined()
})

it('does not drop unrelated NotAllowedErrors or unknown platform failures', () => {
    expect(beforeSendHandler(event('Permission denied'))).not.toBeNull()
    expect(beforeSendHandler(event('(com.apple.AuthenticationServices.AuthorizationError error 1002.)'))).not.toBeNull()
})

it('preserves the owning catch fingerprint and operation tags in both sinks', () => {
    const e = event(association)
    e.tags = { passkey_reason: 'association_mismatch', passkey_operation: 'login' }
    e.fingerprint = ['passkey-failure', 'login', 'association_mismatch']
    const inner = jest.fn((value) => value)
    withoutNoise({ processEvent: inner }).processEvent(e)
    expect(beforeSendHandler(e)?.fingerprint).toEqual(['passkey-failure', 'login', 'association_mismatch'])
    expect(e.tags.passkey_operation).toBe('login')
})
