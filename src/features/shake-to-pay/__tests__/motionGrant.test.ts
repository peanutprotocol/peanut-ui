import { forgetMotionGrant, hasRememberedMotionGrant, motionNeedsPermission, rememberMotionGrant } from '../motionGrant'

const key = 'peanut.shakeMotionGranted'
const originalStorage = Object.getOwnPropertyDescriptor(window, 'localStorage')
const originalMotion = Object.getOwnPropertyDescriptor(window, 'DeviceMotionEvent')

function restore(target: object, name: string, descriptor: PropertyDescriptor | undefined): void {
    if (descriptor) Object.defineProperty(target, name, descriptor)
    else Reflect.deleteProperty(target, name)
}

beforeEach(() => {
    window.localStorage.clear()
})

afterEach(() => {
    jest.restoreAllMocks()
    restore(window, 'localStorage', originalStorage)
    restore(window, 'DeviceMotionEvent', originalMotion)
    window.localStorage.clear()
})

describe('remembered device motion grant', () => {
    it('stores the exact grant marker and removes only that marker', () => {
        window.localStorage.setItem('unrelated', 'keep')
        expect(hasRememberedMotionGrant()).toBe(false)
        rememberMotionGrant()
        expect(window.localStorage.getItem(key)).toBe('1')
        expect(hasRememberedMotionGrant()).toBe(true)
        rememberMotionGrant()
        expect(hasRememberedMotionGrant()).toBe(true)
        forgetMotionGrant()
        forgetMotionGrant()
        expect(window.localStorage.getItem(key)).toBeNull()
        expect(hasRememberedMotionGrant()).toBe(false)
        expect(window.localStorage.getItem('unrelated')).toBe('keep')
    })

    it.each(['', '0', 'true', 'granted', ' 1', '1 ', '01'])('rejects malformed marker %p', (value) => {
        window.localStorage.setItem(key, value)
        expect(hasRememberedMotionGrant()).toBe(false)
    })

    it.each(['missing', 'getter'] as const)('fails closed without crashing when storage is %s', (fault) => {
        Object.defineProperty(
            window,
            'localStorage',
            fault === 'missing'
                ? { configurable: true, value: undefined }
                : {
                      configurable: true,
                      get: () => {
                          throw new Error('Storage inaccessible')
                      },
                  }
        )
        expect(() => rememberMotionGrant()).not.toThrow()
        expect(() => forgetMotionGrant()).not.toThrow()
        expect(hasRememberedMotionGrant()).toBe(false)
    })

    it.each(['getItem', 'setItem', 'removeItem'] as const)('contains a throwing storage %s method', (method) => {
        window.localStorage.setItem(key, '1')
        jest.spyOn(Storage.prototype, method).mockImplementation(() => {
            throw new Error('Storage failed')
        })
        if (method === 'getItem') expect(hasRememberedMotionGrant()).toBe(false)
        else if (method === 'setItem') expect(() => rememberMotionGrant()).not.toThrow()
        else expect(() => forgetMotionGrant()).not.toThrow()
    })
})

describe('motion permission API detection', () => {
    it('requires permission exactly when requestPermission is callable', () => {
        Object.defineProperty(window, 'DeviceMotionEvent', {
            configurable: true,
            value: Object.assign(class {}, { requestPermission: jest.fn() }),
        })
        expect(motionNeedsPermission()).toBe(true)
    })

    it.each([undefined, null, false, 'granted', {}, 1])(
        'ignores a nonfunction requestPermission %p',
        (requestPermission) => {
            Object.defineProperty(window, 'DeviceMotionEvent', {
                configurable: true,
                value: Object.assign(class {}, { requestPermission }),
            })
            expect(motionNeedsPermission()).toBe(false)
        }
    )

    it('is safe when the DeviceMotionEvent global is absent', () => {
        Reflect.deleteProperty(window, 'DeviceMotionEvent')
        expect(motionNeedsPermission()).toBe(false)
    })
})
