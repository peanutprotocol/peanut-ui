import { OneSignalConfigError, isPermanentOneSignalInitError } from './errors'

describe('isPermanentOneSignalInitError', () => {
    it.each([
        ['a missing build config', new OneSignalConfigError('OneSignal configuration missing: X is required')],
        ['a plugin missing from the binary', Object.assign(new Error('not implemented'), { code: 'UNIMPLEMENTED' })],
        ['an origin the app is restricted from', new Error('Can only be used on: https://staging.peanut.me')],
        ['an app without web push', new Error('App not configured for web push')],
        ['a second web SDK init', new Error('SDK already initialized')],
    ])('treats %s as permanent', (_, error) => {
        expect(isPermanentOneSignalInitError(error)).toBe(true)
    })

    it.each([
        ['the config fetch timing out', new Error('Timeout')],
        ['a native bridge failure', new Error('bridge unavailable')],
        ['a chunk load failure', Object.assign(new Error('Loading chunk 9 failed.'), { name: 'ChunkLoadError' })],
    ])('treats %s as transient', (_, error) => {
        expect(isPermanentOneSignalInitError(error)).toBe(false)
    })
})
