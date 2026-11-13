/** @jest-environment jsdom */
import { HAS_LOGGED_IN_ON_DEVICE_KEY, hasLoggedInOnDevice, markLoggedInOnDevice } from '../device-login-history'

beforeEach(() => localStorage.clear())
afterEach(() => jest.restoreAllMocks())

it('has the device-scoped public key and stores only an idempotent sentinel', () => {
    expect(HAS_LOGGED_IN_ON_DEVICE_KEY).toBe('peanut-has-logged-in-on-device')
    expect(hasLoggedInOnDevice()).toBe(false)
    markLoggedInOnDevice()
    markLoggedInOnDevice()
    expect(localStorage.getItem(HAS_LOGGED_IN_ON_DEVICE_KEY)).toBe('true')
    expect(hasLoggedInOnDevice()).toBe(true)
})
it.each(['', 'false', '1', 'TRUE', ' true ', '{}', 'null', 'undefined', 'user-123'])(
    'does not recognize malformed sentinel %j',
    (value) => {
        localStorage.setItem(HAS_LOGGED_IN_ON_DEVICE_KEY, value)
        expect(hasLoggedInOnDevice()).toBe(false)
    }
)
it('degrades a denied storage read to no history', () => {
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new DOMException('Denied', 'SecurityError')
    })
    expect(hasLoggedInOnDevice()).toBe(false)
})
it('never throws when storage writes are denied', () => {
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('Denied', 'SecurityError')
    })
    expect(() => markLoggedInOnDevice()).not.toThrow()
})
