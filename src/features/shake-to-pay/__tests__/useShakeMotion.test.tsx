import { act, cleanup, renderHook } from '@testing-library/react'
import { hasRememberedMotionGrant } from '../motionGrant'
import { useShakeMotion } from '../useShakeMotion'

const key = 'peanut.shakeMotionGranted'
const originalMotion = Object.getOwnPropertyDescriptor(window, 'DeviceMotionEvent')
const originalStorage = Object.getOwnPropertyDescriptor(window, 'localStorage')
const requestPermission = jest.fn()

function emitShake(): void {
    act(() => {
        for (const [index, x] of [0, 30, 0].entries()) {
            const event = new Event('devicemotion')
            Object.defineProperties(event, {
                acceleration: { value: { x, y: 0, z: 0 } },
                timeStamp: { value: 300 + index * 100 },
            })
            window.dispatchEvent(event)
        }
    })
}

beforeEach(() => {
    window.localStorage.clear()
    requestPermission.mockReset().mockResolvedValue('granted')
    Object.defineProperty(window, 'DeviceMotionEvent', {
        configurable: true,
        value: Object.assign(class {}, { requestPermission }),
    })
})

afterEach(() => {
    cleanup()
    jest.restoreAllMocks()
    if (originalMotion) Object.defineProperty(window, 'DeviceMotionEvent', originalMotion)
    else Reflect.deleteProperty(window, 'DeviceMotionEvent')
    if (originalStorage) Object.defineProperty(window, 'localStorage', originalStorage)
    else Reflect.deleteProperty(window, 'localStorage')
    window.localStorage.clear()
})

describe('explicit Shake motion consent persistence', () => {
    it.each([false, true])('waits for the explicit action even when remembered consent is %s', (remembered) => {
        if (remembered) window.localStorage.setItem(key, '1')
        const onShake = jest.fn()
        const { result } = renderHook(() => useShakeMotion({ onShake }))
        expect(result.current.status).toBe('needs-permission')
        emitShake()
        expect(requestPermission).not.toHaveBeenCalled()
        expect(onShake).not.toHaveBeenCalled()
    })

    it('remembers an explicit grant, preserves listening status and forwards sensor motion', async () => {
        const onShake = jest.fn()
        const { result } = renderHook(() => useShakeMotion({ onShake }))
        await act(async () => {
            await result.current.requestPermission()
        })
        expect(requestPermission).toHaveBeenCalledTimes(1)
        expect(result.current.status).toBe('listening')
        expect(window.localStorage.getItem(key)).toBe('1')
        expect(hasRememberedMotionGrant()).toBe(true)
        emitShake()
        expect(onShake).toHaveBeenCalledTimes(1)
    })

    it.each(['denied', 'default', 'reject'])(
        'reports denied without motion when explicit permission is %s',
        async (response) => {
            window.localStorage.setItem(key, '1')
            if (response === 'reject') requestPermission.mockRejectedValue(new Error('Permission unavailable'))
            else requestPermission.mockResolvedValue(response)
            const onShake = jest.fn()
            const { result } = renderHook(() => useShakeMotion({ onShake }))
            await act(async () => {
                await result.current.requestPermission()
            })
            expect(requestPermission).toHaveBeenCalledTimes(1)
            expect(result.current.status).toBe('denied')
            if (response === 'denied') {
                expect(window.localStorage.getItem(key)).toBeNull()
                expect(hasRememberedMotionGrant()).toBe(false)
            }
            emitShake()
            expect(onShake).not.toHaveBeenCalled()
        }
    )

    it.each(['getter', 'setItem'] as const)(
        'preserves explicit granted sensor behavior when storage %s throws',
        async (fault) => {
            if (fault === 'getter')
                Object.defineProperty(window, 'localStorage', {
                    configurable: true,
                    get: () => {
                        throw new Error('Storage inaccessible')
                    },
                })
            else
                jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
                    throw new Error('Storage write failed')
                })
            const onShake = jest.fn()
            const { result } = renderHook(() => useShakeMotion({ onShake }))
            await act(async () => {
                await result.current.requestPermission()
            })
            expect(result.current.status).toBe('listening')
            emitShake()
            expect(onShake).toHaveBeenCalledTimes(1)
        }
    )

    it('preserves denied status when removing the stored marker fails', async () => {
        window.localStorage.setItem(key, '1')
        requestPermission.mockResolvedValue('denied')
        jest.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
            throw new Error('Storage removal failed')
        })
        const onShake = jest.fn()
        const { result } = renderHook(() => useShakeMotion({ onShake }))
        await act(async () => {
            await result.current.requestPermission()
        })
        expect(result.current.status).toBe('denied')
        emitShake()
        expect(onShake).not.toHaveBeenCalled()
    })

    it('listens immediately without the permission API and leaves consent storage untouched', () => {
        Object.defineProperty(window, 'DeviceMotionEvent', { configurable: true, value: class {} })
        const onShake = jest.fn()
        const { result } = renderHook(() => useShakeMotion({ onShake }))
        expect(result.current.status).toBe('listening')
        expect(window.localStorage.getItem(key)).toBeNull()
        emitShake()
        expect(onShake).toHaveBeenCalledTimes(1)
        expect(requestPermission).not.toHaveBeenCalled()
    })
})
