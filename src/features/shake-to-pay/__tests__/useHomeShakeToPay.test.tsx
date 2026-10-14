import React, { StrictMode } from 'react'
import { act, cleanup, render, renderHook, screen } from '@testing-library/react'
import Home from '@/app/(mobile-ui)/home/page'
import { useHomeShakeToPay } from '../useHomeShakeToPay'

const mockPush = jest.fn()
const mockHaptic = jest.fn()
let mockFlagEnabled = true
const mockFeatureCheck = jest.fn(() => mockFlagEnabled)
let mockRouter = { push: mockPush }

jest.mock('next/navigation', () => ({ useRouter: () => mockRouter }))
jest.mock('@/hooks/useFeatureFlag', () => ({ useFeatureFlags: () => mockFeatureCheck }))
jest.mock('@/utils/haptics', () => ({ impactHaptic: () => mockHaptic() }))
jest.mock('@/features/home/HomePage', () => {
    const Marker = () => <div data-testid="home-content">Home content</div>
    return { __esModule: true, default: Marker, HomePage: Marker }
})

type Vector = { x: number | null; y: number | null; z: number | null }
type Rotation = { alpha: number | null; beta: number | null; gamma: number | null }
type SensorFields = {
    accelerationIncludingGravity: Vector | null
    acceleration: Vector | null
    rotationRate: Rotation | null
}
const rates = [30, 60, 100]
const destination = '/send?view=shake&shook=1'
const originalMotionDescriptor = Object.getOwnPropertyDescriptor(window, 'DeviceMotionEvent')
const originalVisibilityDescriptor = Object.getOwnPropertyDescriptor(document, 'visibilityState')
const originalHiddenDescriptor = Object.getOwnPropertyDescriptor(document, 'hidden')
const mockRequestPermission = jest.fn().mockResolvedValue('granted')

function setVisibility(visible: boolean): void {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: visible ? 'visible' : 'hidden' })
    Object.defineProperty(document, 'hidden', { configurable: true, value: !visible })
}

function changeVisibility(visible: boolean): void {
    act(() => {
        setVisibility(visible)
        document.dispatchEvent(new Event('visibilitychange'))
    })
}

function motionEvent(t: number, fields: Partial<SensorFields> = {}): Event {
    const event = new Event('devicemotion')
    const sensors: SensorFields = {
        accelerationIncludingGravity: { x: 0, y: 0, z: 9.81 },
        acceleration: { x: 0, y: 0, z: 0 },
        rotationRate: null,
        ...fields,
    }
    Object.defineProperties(event, {
        timeStamp: { value: t },
        accelerationIncludingGravity: { value: sensors.accelerationIncludingGravity },
        acceleration: { value: sensors.acceleration },
        rotationRate: { value: sensors.rotationRate },
    })
    return event
}

function dispatch(events: Event[]): void {
    act(() => {
        events.forEach((event) => window.dispatchEvent(event))
    })
}

function linearEvents(values: number[], start = 100): Event[] {
    return values.map((x, index) => motionEvent(start + index * 100, { acceleration: { x, y: 0, z: 0 } }))
}

function gesture(
    rate: number,
    mode: 'vigorous' | 'gentle' | 'twist',
    source: 'linear' | 'gravity' | 'rotation-only' = 'linear'
): Event[] {
    const duration = mode === 'gentle' ? 2 : mode === 'twist' ? 1 : 0.8
    return Array.from({ length: Math.floor((duration + 1.2) * rate) + 1 }, (_, index) => {
        const seconds = index / rate
        const active = seconds >= 1 && seconds <= 1 + duration
        const x =
            active && mode !== 'twist'
                ? (mode === 'gentle' ? 6 : 20) * Math.sin(2 * Math.PI * (mode === 'gentle' ? 2.5 : 4.5) * (seconds - 1))
                : 0
        const alpha = active && mode === 'twist' ? 300 * Math.sin(6 * Math.PI * (seconds - 1)) : 0
        return motionEvent(seconds * 1000, {
            accelerationIncludingGravity: source === 'rotation-only' ? null : { x, y: 0, z: 9.81 },
            acceleration: source === 'linear' ? { x, y: 0, z: 0 } : null,
            rotationRate: mode === 'twist' ? { alpha, beta: 0, gamma: 0 } : null,
        })
    })
}

function expectNavigation(): void {
    expect(mockPush).toHaveBeenCalledTimes(1)
    expect(mockPush).toHaveBeenCalledWith(destination)
    expect(mockHaptic).toHaveBeenCalledTimes(1)
}

function expectNoEffects(): void {
    expect(mockPush).not.toHaveBeenCalled()
    expect(mockHaptic).not.toHaveBeenCalled()
    expect(mockRequestPermission).not.toHaveBeenCalled()
}

function restoreProperty(target: object, key: string, descriptor: PropertyDescriptor | undefined): void {
    if (descriptor) Object.defineProperty(target, key, descriptor)
    else Reflect.deleteProperty(target, key)
}

beforeEach(() => {
    jest.clearAllMocks()
    mockRequestPermission.mockReset().mockResolvedValue('granted')
    mockRouter = { push: mockPush }
    window.localStorage.clear()
    mockFlagEnabled = true
    setVisibility(true)
    Object.defineProperty(window, 'DeviceMotionEvent', {
        configurable: true,
        value: function DeviceMotionEvent() {},
    })
})

afterEach(() => {
    cleanup()
    jest.restoreAllMocks()
    restoreProperty(window, 'localStorage', originalStorageDescriptor)
    window.localStorage.clear()
    jest.useRealTimers()
    restoreProperty(window, 'DeviceMotionEvent', originalMotionDescriptor)
    restoreProperty(document, 'visibilityState', originalVisibilityDescriptor)
    restoreProperty(document, 'hidden', originalHiddenDescriptor)
})

describe('passive Home shake entry', () => {
    it('checks the same feature flag with the nonproduction bypass', () => {
        renderHook(() => useHomeShakeToPay())
        expect(mockFeatureCheck).toHaveBeenCalledWith('shake_to_pay', { nonProdBypass: true })
        expectNoEffects()
    })

    it.each(rates.flatMap((rate) => (['linear', 'gravity'] as const).map((source) => ({ rate, source }))))(
        'navigates and haptics exactly once for vigorous $source motion at $rate Hz',
        ({ rate, source }) => {
            renderHook(() => useHomeShakeToPay())
            dispatch(gesture(rate, 'vigorous', source))
            expectNavigation()
            expect(mockRequestPermission).not.toHaveBeenCalled()
        }
    )

    it.each(rates.flatMap((rate) => (['linear', 'gravity'] as const).map((source) => ({ rate, source }))))(
        'ignores gentle $source motion at $rate Hz',
        ({ rate, source }) => {
            renderHook(() => useHomeShakeToPay())
            dispatch(gesture(rate, 'gentle', source))
            expectNoEffects()
        }
    )

    it.each(rates.flatMap((rate) => (['linear', 'rotation-only'] as const).map((source) => ({ rate, source }))))(
        'navigates once for twist with $source sensors at $rate Hz',
        ({ rate, source }) => {
            renderHook(() => useHomeShakeToPay())
            dispatch(gesture(rate, 'twist', source))
            expectNavigation()
            expect(mockRequestPermission).not.toHaveBeenCalled()
        }
    )

    it('does not navigate for a single bump or gentle circular motion', () => {
        renderHook(() => useHomeShakeToPay())
        dispatch(linearEvents([0, 30, 0]))
        const events = Array.from({ length: 73 }, (_, index) => {
            const angle = (3 * Math.PI * index) / 60
            return motionEvent(1000 + (index * 1000) / 60, {
                acceleration: { x: 7 * Math.cos(angle), y: 7 * Math.sin(angle), z: 0 },
            })
        })
        dispatch(events)
        expectNoEffects()
    })

    it('allows a vigorous circular trajectory because circular arbitration is disabled', () => {
        renderHook(() => useHomeShakeToPay())
        dispatch([
            motionEvent(0),
            ...Array.from({ length: 73 }, (_, index) => {
                const angle = (3 * Math.PI * index) / 60
                return motionEvent(1000 + (index * 1000) / 60, {
                    acceleration: { x: 20 * Math.cos(angle), y: 20 * Math.sin(angle), z: 0 },
                })
            }),
        ])
        expectNavigation()
    })

    it('shares cooldown when vigorous and twist qualify together', () => {
        renderHook(() => useHomeShakeToPay())
        dispatch(
            [0, 1, -1, 1, -1, 1].map((sign, index) =>
                motionEvent(index * 100, {
                    acceleration: { x: sign * 20, y: 0, z: 0 },
                    rotationRate: { alpha: sign * 300, beta: 0, gamma: 0 },
                })
            )
        )
        expectNavigation()
    })

    it('does not attach a motion listener while the flag is disabled', () => {
        mockFlagEnabled = false
        const add = jest.spyOn(window, 'addEventListener')
        renderHook(() => useHomeShakeToPay())
        expect(add.mock.calls.filter(([type]) => type === 'devicemotion')).toEqual([])
        dispatch(gesture(60, 'vigorous'))
        expectNoEffects()
    })

    it('reacts to flag changes, removes its listener, and resets partial motion', () => {
        mockFlagEnabled = false
        const add = jest.spyOn(window, 'addEventListener')
        const remove = jest.spyOn(window, 'removeEventListener')
        const { rerender } = renderHook(() => useHomeShakeToPay())
        mockFlagEnabled = true
        rerender()
        const registration = add.mock.calls.find(([type]) => type === 'devicemotion')
        expect(registration).toBeDefined()
        dispatch(linearEvents([0, 20, -20]))
        mockFlagEnabled = false
        rerender()
        expect(
            remove.mock.calls.some(([type, handler]) => type === 'devicemotion' && handler === registration?.[1])
        ).toBe(true)
        dispatch(gesture(60, 'vigorous'))
        act(() => {
            const stale = registration?.[1] as EventListener
            linearEvents([0, 20, -20, 20], 400).forEach((event) => stale(event))
        })
        expectNoEffects()
        mockFlagEnabled = true
        rerender()
        dispatch(linearEvents([20, -20], 3000))
        expectNoEffects()
        dispatch(linearEvents([20], 3200))
        expectNavigation()
    })

    it('starts hidden without a motion listener and attaches when visible', () => {
        setVisibility(false)
        const add = jest.spyOn(window, 'addEventListener')
        renderHook(() => useHomeShakeToPay())
        expect(add.mock.calls.filter(([type]) => type === 'devicemotion')).toEqual([])
        dispatch(gesture(60, 'vigorous'))
        expectNoEffects()
        changeVisibility(true)
        dispatch(gesture(60, 'vigorous'))
        expectNavigation()
    })

    it('clears partial motion when hidden and requires three fresh peaks after resume', () => {
        const add = jest.spyOn(window, 'addEventListener')
        renderHook(() => useHomeShakeToPay())
        const registration = add.mock.calls.find(([type]) => type === 'devicemotion')
        dispatch(linearEvents([0, 20, -20]))
        changeVisibility(false)
        dispatch(linearEvents([20, -20, 20], 400))
        act(() => {
            const stale = registration?.[1] as EventListener
            linearEvents([20, -20, 20], 700).forEach((event) => stale(event))
        })
        expectNoEffects()
        changeVisibility(true)
        dispatch(linearEvents([20, -20], 1000))
        expectNoEffects()
        dispatch(linearEvents([20], 1200))
        expectNavigation()
    })

    it('removes matching motion and visibility handlers; stale callbacks are inert after unmount', () => {
        const addMotion = jest.spyOn(window, 'addEventListener')
        const removeMotion = jest.spyOn(window, 'removeEventListener')
        const addVisibility = jest.spyOn(document, 'addEventListener')
        const removeVisibility = jest.spyOn(document, 'removeEventListener')
        const { unmount } = renderHook(() => useHomeShakeToPay())
        const motion = addMotion.mock.calls.find(([type]) => type === 'devicemotion')
        const visibility = addVisibility.mock.calls.find(([type]) => type === 'visibilitychange')
        expect(motion).toBeDefined()
        expect(visibility).toBeDefined()
        dispatch(linearEvents([0, 20, -20]))
        unmount()
        expect(
            removeMotion.mock.calls.some(([type, handler]) => type === 'devicemotion' && handler === motion?.[1])
        ).toBe(true)
        expect(
            removeVisibility.mock.calls.some(
                ([type, handler]) => type === 'visibilitychange' && handler === visibility?.[1]
            )
        ).toBe(true)
        act(() => {
            gesture(60, 'vigorous').forEach((event) => (motion?.[1] as EventListener)(event))
            ;(visibility?.[1] as EventListener)(new Event('visibilitychange'))
        })
        expect(addMotion.mock.calls.filter(([type]) => type === 'devicemotion')).toHaveLength(1)
        expectNoEffects()
    })

    it('does not request OS permission without a permission API, even after silence and a visibility cycle', () => {
        jest.useFakeTimers()
        renderHook(() => useHomeShakeToPay())
        act(() => {
            jest.advanceTimersByTime(10000)
        })
        changeVisibility(false)
        changeVisibility(true)
        act(() => {
            jest.advanceTimersByTime(10000)
        })
        expectNoEffects()
    })

    it.each([
        { accelerationIncludingGravity: null, acceleration: null, rotationRate: null },
        {
            accelerationIncludingGravity: { x: null, y: null, z: null },
            acceleration: { x: NaN, y: 0, z: 0 },
            rotationRate: { alpha: Infinity, beta: 0, gamma: 0 },
        },
    ])('ignores unusable sensor events without poisoning later valid motion: %p', (fields) => {
        renderHook(() => useHomeShakeToPay())
        dispatch([motionEvent(1e9, fields)])
        expectNoEffects()
        dispatch(gesture(60, 'vigorous'))
        expectNavigation()
    })

    it('falls back to gravity when optional acceleration and rotation contain invalid values', () => {
        renderHook(() => useHomeShakeToPay())
        const events = gesture(60, 'vigorous', 'gravity').map((event) => {
            const fields = event as unknown as SensorFields
            return motionEvent(event.timeStamp, {
                accelerationIncludingGravity: fields.accelerationIncludingGravity,
                acceleration: { x: NaN, y: 0, z: 0 },
                rotationRate: { alpha: null, beta: null, gamma: null },
            })
        })
        dispatch(events)
        expectNavigation()
    })

    it('does not count duplicate or backwards timestamps as fresh peaks', () => {
        renderHook(() => useHomeShakeToPay())
        dispatch(linearEvents([0, 20, -20]))
        dispatch([
            motionEvent(300, { acceleration: { x: 20, y: 0, z: 0 } }),
            motionEvent(250, { acceleration: { x: 20, y: 0, z: 0 } }),
        ])
        expectNoEffects()
        dispatch(linearEvents([20], 400))
        expectNavigation()
    })

    it('does not accumulate active listeners or duplicate effects under StrictMode', () => {
        const add = jest.spyOn(window, 'addEventListener')
        const remove = jest.spyOn(window, 'removeEventListener')
        renderHook(() => useHomeShakeToPay(), { wrapper: ({ children }) => <StrictMode>{children}</StrictMode> })
        const registrations = add.mock.calls.filter(([type]) => type === 'devicemotion')
        const removals = remove.mock.calls.filter(([type]) => type === 'devicemotion')
        expect(registrations.length - removals.length).toBe(1)
        dispatch(gesture(60, 'vigorous'))
        expectNavigation()
    })
})

describe('Home route integration', () => {
    it('retains Home content and mounts one passive shake entry', () => {
        render(<Home />)
        expect(screen.getByTestId('home-content')).toBeInTheDocument()
        dispatch(gesture(60, 'vigorous'))
        expectNavigation()
        expect(screen.getByTestId('home-content')).toBeInTheDocument()
        expect(mockRequestPermission).not.toHaveBeenCalled()
    })

    it('retains Home content without motion side effects when the flag is off', () => {
        mockFlagEnabled = false
        render(<Home />)
        expect(screen.getByTestId('home-content')).toBeInTheDocument()
        dispatch(gesture(60, 'vigorous'))
        expectNoEffects()
    })
})

const grantKey = 'peanut.shakeMotionGranted'
const originalStorageDescriptor = Object.getOwnPropertyDescriptor(window, 'localStorage')

function installPermissionApi(remembered = false): void {
    Object.defineProperty(window, 'DeviceMotionEvent', {
        configurable: true,
        value: Object.assign(function DeviceMotionEvent() {}, { requestPermission: mockRequestPermission }),
    })
    if (remembered) window.localStorage.setItem(grantKey, '1')
}

function tap(): void {
    act(() => {
        document.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    })
}

async function settlePermission(): Promise<void> {
    await act(async () => {
        await Promise.resolve()
    })
}

function deferredPermission(): { promise: Promise<string>; resolve: (value: string) => void } {
    let resolve!: (value: string) => void
    const promise = new Promise<string>((done) => {
        resolve = done
    })
    return { promise, resolve }
}

function laterGesture(offset = 10000): Event[] {
    return gesture(60, 'vigorous').map((event) =>
        motionEvent(event.timeStamp + offset, event as unknown as SensorFields)
    )
}

describe('Home remembered iOS motion consent', () => {
    it.each([null, '', '0', 'true', 'granted', ' 1', '1 '])(
        'stays off with remembered value %p through taps, visibility cycles and synthetic motion',
        async (value) => {
            installPermissionApi()
            if (value !== null) window.localStorage.setItem(grantKey, value)
            const add = jest.spyOn(window, 'addEventListener')
            renderHook(() => useHomeShakeToPay())
            tap()
            changeVisibility(false)
            changeVisibility(true)
            tap()
            await settlePermission()
            dispatch(gesture(60, 'vigorous'))
            expect(add.mock.calls.filter(([type]) => type === 'devicemotion')).toHaveLength(0)
            expectNoEffects()
        }
    )

    it('does not request permission or listen before the first gesture despite a remembered grant', () => {
        installPermissionApi(true)
        const add = jest.spyOn(window, 'addEventListener')
        renderHook(() => useHomeShakeToPay())
        changeVisibility(false)
        changeVisibility(true)
        dispatch(gesture(60, 'vigorous'))
        expect(add.mock.calls.filter(([type]) => type === 'devicemotion')).toHaveLength(0)
        expectNoEffects()
    })

    it('requests synchronously on the first passive capture pointerdown and listens only after grant', async () => {
        installPermissionApi(true)
        const pending = deferredPermission()
        mockRequestPermission.mockReturnValue(pending.promise)
        const addMotion = jest.spyOn(window, 'addEventListener')
        const addPointer = jest.spyOn(document, 'addEventListener')
        renderHook(() => useHomeShakeToPay())
        const pointer = addPointer.mock.calls.find(([type]) => type === 'pointerdown')
        expect(pointer).toBeDefined()
        expect(pointer?.[2]).toEqual(expect.objectContaining({ capture: true, passive: true, once: true }))
        let duringDispatch = false
        mockRequestPermission.mockImplementation(() => {
            duringDispatch = true
            return pending.promise
        })
        tap()
        expect(duringDispatch).toBe(true)
        expect(mockRequestPermission).toHaveBeenCalledTimes(1)
        tap()
        expect(mockRequestPermission).toHaveBeenCalledTimes(1)
        expect(addMotion.mock.calls.filter(([type]) => type === 'devicemotion')).toHaveLength(0)
        dispatch(gesture(60, 'vigorous'))
        expect(mockPush).not.toHaveBeenCalled()
        await act(async () => pending.resolve('granted'))
        dispatch(gesture(60, 'vigorous'))
        expectNavigation()
        tap()
        changeVisibility(false)
        changeVisibility(true)
        dispatch(laterGesture())
        expectNavigation()
        expect(mockRequestPermission).toHaveBeenCalledTimes(1)
    })

    it.each(['denied', 'default', 'reject', 'throw'])(
        'remains off without retry when permission is %s',
        async (response) => {
            installPermissionApi(true)
            if (response === 'reject') mockRequestPermission.mockRejectedValue(new Error('Permission unavailable'))
            else if (response === 'throw')
                mockRequestPermission.mockImplementation(() => {
                    throw new Error('Gesture rejected')
                })
            else mockRequestPermission.mockResolvedValue(response)
            const add = jest.spyOn(window, 'addEventListener')
            renderHook(() => useHomeShakeToPay())
            tap()
            await settlePermission()
            tap()
            changeVisibility(false)
            changeVisibility(true)
            tap()
            dispatch(gesture(60, 'vigorous'))
            expect(mockRequestPermission).toHaveBeenCalledTimes(1)
            expect(add.mock.calls.filter(([type]) => type === 'devicemotion')).toHaveLength(0)
            expect(mockPush).not.toHaveBeenCalled()
            expect(mockHaptic).not.toHaveBeenCalled()
            if (response !== 'default') expect(window.localStorage.getItem(grantKey)).toBeNull()
        }
    )

    it.each(['unmount', 'flag-off', 'router-change'] as const)(
        'removes the unused pointerdown handler on %s and leaves its stale callback inert',
        async (stop) => {
            installPermissionApi(true)
            const add = jest.spyOn(document, 'addEventListener')
            const remove = jest.spyOn(document, 'removeEventListener')
            const { unmount, rerender } = renderHook(() => useHomeShakeToPay())
            const pointer = add.mock.calls.find(([type]) => type === 'pointerdown')
            expect(pointer).toBeDefined()
            if (stop === 'unmount') unmount()
            else {
                if (stop === 'flag-off') mockFlagEnabled = false
                else mockRouter = { push: jest.fn() }
                rerender()
            }
            const removal = remove.mock.calls.find(
                ([type, handler]) => type === 'pointerdown' && handler === pointer?.[1]
            )
            expect(removal).toBeDefined()
            const options = removal?.[2]
            expect(options === true || (typeof options === 'object' && options?.capture === true)).toBe(true)
            act(() => (pointer?.[1] as EventListener)(new Event('pointerdown')))
            await settlePermission()
            expectNoEffects()
        }
    )

    it.each(['unmount', 'flag-off', 'router-change'] as const)(
        'ignores a deferred grant resolving after %s',
        async (stop) => {
            installPermissionApi(true)
            const pending = deferredPermission()
            mockRequestPermission.mockReturnValue(pending.promise)
            const add = jest.spyOn(window, 'addEventListener')
            const { unmount, rerender } = renderHook(() => useHomeShakeToPay())
            tap()
            expect(mockRequestPermission).toHaveBeenCalledTimes(1)
            if (stop === 'unmount') unmount()
            else {
                if (stop === 'flag-off') mockFlagEnabled = false
                else mockRouter = { push: jest.fn() }
                rerender()
            }
            await act(async () => pending.resolve('granted'))
            changeVisibility(false)
            changeVisibility(true)
            dispatch(gesture(60, 'vigorous'))
            expect(add.mock.calls.filter(([type]) => type === 'devicemotion')).toHaveLength(0)
            expect(mockPush).not.toHaveBeenCalled()
            expect(mockRouter.push).not.toHaveBeenCalled()
            expect(mockHaptic).not.toHaveBeenCalled()
            expect(mockRequestPermission).toHaveBeenCalledTimes(1)
        }
    )

    it('does not attach when a grant resolves while hidden and attaches on the next visible event', async () => {
        installPermissionApi(true)
        const pending = deferredPermission()
        mockRequestPermission.mockReturnValue(pending.promise)
        const add = jest.spyOn(window, 'addEventListener')
        renderHook(() => useHomeShakeToPay())
        tap()
        changeVisibility(false)
        await act(async () => pending.resolve('granted'))
        expect(add.mock.calls.filter(([type]) => type === 'devicemotion')).toHaveLength(0)
        dispatch(gesture(60, 'vigorous'))
        expect(mockPush).not.toHaveBeenCalled()
        changeVisibility(true)
        dispatch(gesture(60, 'vigorous'))
        expectNavigation()
        expect(mockRequestPermission).toHaveBeenCalledTimes(1)
    })

    it('keeps a pending request off through repeated taps and visibility cycles', () => {
        installPermissionApi(true)
        mockRequestPermission.mockReturnValue(new Promise(() => {}))
        const add = jest.spyOn(window, 'addEventListener')
        renderHook(() => useHomeShakeToPay())
        tap()
        for (let index = 0; index < 5; index++) {
            changeVisibility(false)
            changeVisibility(true)
            tap()
            dispatch(laterGesture(index * 10000))
        }
        expect(mockRequestPermission).toHaveBeenCalledTimes(1)
        expect(add.mock.calls.filter(([type]) => type === 'devicemotion')).toHaveLength(0)
        expect(mockPush).not.toHaveBeenCalled()
        expect(mockHaptic).not.toHaveBeenCalled()
    })

    it('removes granted motion and visibility handlers on unmount', async () => {
        installPermissionApi(true)
        const addMotion = jest.spyOn(window, 'addEventListener')
        const removeMotion = jest.spyOn(window, 'removeEventListener')
        const addDocument = jest.spyOn(document, 'addEventListener')
        const removeDocument = jest.spyOn(document, 'removeEventListener')
        const { unmount } = renderHook(() => useHomeShakeToPay())
        tap()
        await settlePermission()
        const motion = addMotion.mock.calls.find(([type]) => type === 'devicemotion')
        const visibility = addDocument.mock.calls.find(([type]) => type === 'visibilitychange')
        expect(motion).toBeDefined()
        expect(visibility).toBeDefined()
        unmount()
        expect(
            removeMotion.mock.calls.some(([type, handler]) => type === 'devicemotion' && handler === motion?.[1])
        ).toBe(true)
        expect(
            removeDocument.mock.calls.some(
                ([type, handler]) => type === 'visibilitychange' && handler === visibility?.[1]
            )
        ).toBe(true)
        act(() => {
            gesture(60, 'vigorous').forEach((event) => (motion?.[1] as EventListener)(event))
            ;(visibility?.[1] as EventListener)(new Event('visibilitychange'))
        })
        expect(mockPush).not.toHaveBeenCalled()
        expect(mockHaptic).not.toHaveBeenCalled()
        expect(addMotion.mock.calls.filter(([type]) => type === 'devicemotion')).toHaveLength(1)
    })

    it('keeps one live gesture handler under StrictMode and makes one request', async () => {
        installPermissionApi(true)
        const add = jest.spyOn(document, 'addEventListener')
        const remove = jest.spyOn(document, 'removeEventListener')
        renderHook(() => useHomeShakeToPay(), { wrapper: ({ children }) => <StrictMode>{children}</StrictMode> })
        expect(
            add.mock.calls.filter(([type]) => type === 'pointerdown').length -
                remove.mock.calls.filter(([type]) => type === 'pointerdown').length
        ).toBe(1)
        tap()
        tap()
        await settlePermission()
        dispatch(gesture(60, 'vigorous'))
        expectNavigation()
        expect(mockRequestPermission).toHaveBeenCalledTimes(1)
    })

    it.each(['getter', 'getItem'] as const)('fails closed when the storage %s throws', (fault) => {
        installPermissionApi(true)
        if (fault === 'getter')
            Object.defineProperty(window, 'localStorage', {
                configurable: true,
                get: () => {
                    throw new Error('Storage inaccessible')
                },
            })
        else
            jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
                throw new Error('Storage read failed')
            })
        const add = jest.spyOn(window, 'addEventListener')
        expect(() => renderHook(() => useHomeShakeToPay())).not.toThrow()
        tap()
        changeVisibility(false)
        changeVisibility(true)
        dispatch(gesture(60, 'vigorous'))
        expectNoEffects()
        expect(add.mock.calls.filter(([type]) => type === 'devicemotion')).toHaveLength(0)
    })

    it('stays off if forgetting denied consent cannot write storage', async () => {
        installPermissionApi(true)
        mockRequestPermission.mockResolvedValue('denied')
        jest.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
            throw new Error('Storage removal failed')
        })
        const add = jest.spyOn(window, 'addEventListener')
        renderHook(() => useHomeShakeToPay())
        tap()
        await settlePermission()
        tap()
        changeVisibility(false)
        changeVisibility(true)
        dispatch(gesture(60, 'vigorous'))
        expect(mockRequestPermission).toHaveBeenCalledTimes(1)
        expect(add.mock.calls.filter(([type]) => type === 'devicemotion')).toHaveLength(0)
        expect(mockPush).not.toHaveBeenCalled()
        expect(mockHaptic).not.toHaveBeenCalled()
    })

    it('does not install a remembered-grant pointerdown handler when the flag is disabled', () => {
        installPermissionApi(true)
        mockFlagEnabled = false
        const add = jest.spyOn(document, 'addEventListener')
        renderHook(() => useHomeShakeToPay())
        expect(add.mock.calls.filter(([type]) => type === 'pointerdown')).toHaveLength(0)
        tap()
        expectNoEffects()
    })
})
