import React, { StrictMode } from 'react'
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react'
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

type MotionPermissionState = 'prompt' | 'granted' | 'denied'
type Registration = {
    target: EventTarget
    type: string
    handler: EventListenerOrEventListenerObject
    capture: boolean
    once: boolean
    removed: boolean
    consumed: boolean
}
type ListenerTracker = {
    registrations: Registration[]
    live: (types: ReadonlySet<string>) => Registration[]
    onceListeners: (type: string) => Registration[]
}

const armingTypes: ReadonlySet<string> = new Set([
    'pointerdown',
    'pointerup',
    'pointercancel',
    'click',
    'touchstart',
    'touchend',
    'mousedown',
    'mouseup',
])
const motionTypes: ReadonlySet<string> = new Set(['devicemotion'])
const visibilityTypes: ReadonlySet<string> = new Set(['visibilitychange'])

// WKWebView model: a prompt-state requestPermission() rejects unless it is called synchronously
// inside an activating event (click / pointerup); once decided it resolves without activation.
let motionPermissionState: MotionPermissionState = 'prompt'
let userAnswer: 'granted' | 'denied' = 'granted'
let inActivation = false
const permissionCalls: boolean[] = []
let tracker: ListenerTracker | null = null

function requestMotionPermission(): Promise<'granted' | 'denied'> {
    const activated = inActivation
    permissionCalls.push(activated)
    if (motionPermissionState === 'prompt') {
        if (!activated) {
            return Promise.reject(
                new DOMException(
                    'Requesting device orientation or motion access requires a user gesture to prompt',
                    'NotAllowedError'
                )
            )
        }
        motionPermissionState = userAnswer
    }
    return Promise.resolve(motionPermissionState as 'granted' | 'denied')
}

function installPermissionApi({
    remembered = false,
    state = 'prompt',
    answer = 'granted',
}: { remembered?: boolean; state?: MotionPermissionState; answer?: 'granted' | 'denied' } = {}): void {
    motionPermissionState = state
    userAnswer = answer
    permissionCalls.length = 0
    mockRequestPermission.mockImplementation(requestMotionPermission)
    Object.defineProperty(window, 'DeviceMotionEvent', {
        configurable: true,
        value: Object.assign(function DeviceMotionEvent() {}, { requestPermission: mockRequestPermission }),
    })
    if (remembered) window.localStorage.setItem(grantKey, '1')
}

const instrumentedTargets: EventTarget[] = [window, EventTarget.prototype]
const nativeListenerMethods = new Map(
    instrumentedTargets.map((target) => [target, { add: target.addEventListener, remove: target.removeEventListener }])
)

function captureOf(options?: boolean | AddEventListenerOptions): boolean {
    return typeof options === 'boolean' ? options : Boolean(options?.capture)
}

function eventPath(): EventTarget[] {
    return [window, document, document.documentElement, document.body]
}

function trackListeners(): ListenerTracker {
    const registrations: Registration[] = []
    const find = (target: EventTarget, type: string, handler: unknown, capture: boolean) =>
        registrations.find(
            (entry) =>
                !entry.removed &&
                !entry.consumed &&
                entry.target === target &&
                entry.type === type &&
                entry.handler === handler &&
                entry.capture === capture
        )
    instrumentedTargets.forEach((owner) => {
        const native = nativeListenerMethods.get(owner)!
        jest.spyOn(owner, 'addEventListener').mockImplementation(function (
            this: EventTarget,
            type: string,
            handler: EventListenerOrEventListenerObject | null,
            options?: boolean | AddEventListenerOptions
        ) {
            if (handler && !find(this, type, handler, captureOf(options))) {
                registrations.push({
                    target: this,
                    type,
                    handler,
                    capture: captureOf(options),
                    once: typeof options === 'object' && Boolean(options?.once),
                    removed: false,
                    consumed: false,
                })
            }
            return native.add.call(this, type, handler, options)
        })
        jest.spyOn(owner, 'removeEventListener').mockImplementation(function (
            this: EventTarget,
            type: string,
            handler: EventListenerOrEventListenerObject | null,
            options?: boolean | EventListenerOptions
        ) {
            const hit = handler ? find(this, type, handler, captureOf(options)) : undefined
            if (hit) hit.removed = true
            return native.remove.call(this, type, handler, options)
        })
    })
    tracker = {
        registrations,
        live: (types) =>
            registrations.filter(
                (entry) =>
                    !entry.removed && !entry.consumed && types.has(entry.type) && eventPath().includes(entry.target)
            ),
        onceListeners: (type) =>
            registrations.filter(
                (entry) =>
                    entry.once &&
                    !entry.removed &&
                    !entry.consumed &&
                    entry.type === type &&
                    eventPath().includes(entry.target)
            ),
    }
    return tracker
}

function liveArming(): number {
    return tracker ? tracker.live(armingTypes).length : 0
}

function liveMotion(): number {
    return tracker ? tracker.live(motionTypes).length : 0
}

function liveVisibility(): number {
    return tracker ? tracker.live(visibilityTypes).length : 0
}

function fire(type: string, { activated = true }: { activated?: boolean } = {}): void {
    const event = new Event(type, { bubbles: true, cancelable: true })
    if (type.startsWith('pointer')) {
        Object.defineProperties(event, { pointerType: { value: 'touch' }, isPrimary: { value: true } })
    }
    const onceBefore = tracker ? tracker.onceListeners(type) : []
    inActivation = activated && (type === 'click' || type === 'pointerup')
    try {
        fireEvent(document.body, event)
    } finally {
        inActivation = false
    }
    onceBefore.forEach((entry) => {
        entry.consumed = true
    })
}

function tap(options: { activated?: boolean } = {}): void {
    fire('pointerdown', options)
    fire('pointerup', options)
    fire('click', options)
}

function callHandler(handler: EventListenerOrEventListenerObject, event: Event): void {
    if (typeof handler === 'function') handler(event)
    else handler.handleEvent(event)
}

async function settlePermission(): Promise<void> {
    await act(async () => {
        for (let tick = 0; tick < 5; tick++) await Promise.resolve()
    })
}

function deferredPermission(): {
    promise: Promise<string>
    resolve: (value: string) => void
    reject: (e: Error) => void
} {
    let resolve!: (value: string) => void
    let reject!: (e: Error) => void
    const promise = new Promise<string>((done, fail) => {
        resolve = done
        reject = fail
    })
    return { promise, resolve, reject }
}

function deferRequest(): ReturnType<typeof deferredPermission> {
    const pending = deferredPermission()
    mockRequestPermission.mockImplementation(() => {
        permissionCalls.push(inActivation)
        return pending.promise
    })
    return pending
}

function laterGesture(offset = 10000): Event[] {
    return gesture(60, 'vigorous').map((event) => {
        const { accelerationIncludingGravity, acceleration, rotationRate } = event as unknown as SensorFields
        return motionEvent(event.timeStamp + offset, { accelerationIncludingGravity, acceleration, rotationRate })
    })
}

function expectNoNavigation(): void {
    expect(mockPush).not.toHaveBeenCalled()
    expect(mockHaptic).not.toHaveBeenCalled()
}

function stopHook(
    stop: 'unmount' | 'flag-off' | 'router-change',
    handles: { unmount: () => void; rerender: () => void }
): void {
    if (stop === 'unmount') handles.unmount()
    else {
        if (stop === 'flag-off') mockFlagEnabled = false
        else mockRouter = { push: jest.fn() }
        handles.rerender()
    }
}

beforeEach(() => {
    tracker = null
    inActivation = false
    motionPermissionState = 'prompt'
    userAnswer = 'granted'
    permissionCalls.length = 0
})

describe('Home remembered iOS motion consent', () => {
    it.each([null, '', '0', 'true', 'granted', ' 1', '1 '])(
        'stays off with remembered value %p through taps, visibility cycles and synthetic motion',
        async (value) => {
            installPermissionApi()
            if (value !== null) window.localStorage.setItem(grantKey, value)
            trackListeners()
            renderHook(() => useHomeShakeToPay())
            tap()
            changeVisibility(false)
            changeVisibility(true)
            tap()
            await settlePermission()
            dispatch(gesture(60, 'vigorous'))
            expect(liveMotion()).toBe(0)
            expect(permissionCalls).toEqual([])
            expectNoNavigation()
        }
    )

    it('does not listen before the first activating tap despite a remembered grant', async () => {
        installPermissionApi({ remembered: true })
        trackListeners()
        renderHook(() => useHomeShakeToPay())
        changeVisibility(false)
        changeVisibility(true)
        await settlePermission()
        dispatch(gesture(60, 'vigorous'))
        expect(liveMotion()).toBe(0)
        expectNoNavigation()
        expect(window.localStorage.getItem(grantKey)).toBe('1')
    })

    it('30a: asks inside the first activating tap of a new iOS session and starts listening once granted', async () => {
        installPermissionApi({ remembered: true })
        trackListeners()
        renderHook(() => useHomeShakeToPay())
        tap()
        await settlePermission()
        expect(permissionCalls.filter(Boolean)).toHaveLength(1)
        expect(liveMotion()).toBe(1)
        dispatch(gesture(60, 'vigorous'))
        expectNavigation()
        expect(window.localStorage.getItem(grantKey)).toBe('1')
    })

    it('30a: stays unresolved until the activated request settles, then listens only after grant', async () => {
        installPermissionApi({ remembered: true })
        const pending = deferRequest()
        trackListeners()
        renderHook(() => useHomeShakeToPay())
        tap()
        expect(permissionCalls.filter(Boolean)).toHaveLength(1)
        expect(liveMotion()).toBe(0)
        dispatch(gesture(60, 'vigorous'))
        expectNoNavigation()
        await act(async () => pending.resolve('granted'))
        expect(liveMotion()).toBe(1)
        dispatch(laterGesture())
        expectNavigation()
        tap()
        changeVisibility(false)
        changeVisibility(true)
        expect(permissionCalls.filter(Boolean)).toHaveLength(1)
    })

    it.each([
        ['an unactivated tap sequence', () => tap({ activated: false })],
        ['a bare pointerdown', () => fire('pointerdown')],
    ])('30b: %s keeps the remembered grant and re-arms for the next activating tap', async (_label, gestureFn) => {
        installPermissionApi({ remembered: true })
        trackListeners()
        renderHook(() => useHomeShakeToPay())
        const armed = liveArming()
        expect(armed).toBeGreaterThan(0)
        gestureFn()
        await settlePermission()
        expect(window.localStorage.getItem(grantKey)).toBe('1')
        expect(liveMotion()).toBe(0)
        expect(liveArming()).toBe(armed)
        dispatch(gesture(60, 'vigorous'))
        expectNoNavigation()
        tap()
        await settlePermission()
        expect(liveMotion()).toBe(1)
        dispatch(laterGesture())
        expectNavigation()
        expect(window.localStorage.getItem(grantKey)).toBe('1')
    })

    it('30b: survives repeated unactivated taps and visibility cycles without stacking handlers or prompts', async () => {
        installPermissionApi({ remembered: true })
        trackListeners()
        renderHook(() => useHomeShakeToPay())
        const armed = liveArming()
        for (let attempt = 0; attempt < 3; attempt++) {
            tap({ activated: false })
            await settlePermission()
            changeVisibility(false)
            changeVisibility(true)
            expect(window.localStorage.getItem(grantKey)).toBe('1')
            expect(liveArming()).toBe(armed)
        }
        expect(liveMotion()).toBe(0)
        const activatedBefore = permissionCalls.filter(Boolean).length
        tap()
        await settlePermission()
        expect(permissionCalls.filter(Boolean).length - activatedBefore).toBe(1)
        expect(liveMotion()).toBe(1)
        dispatch(gesture(60, 'vigorous'))
        expectNavigation()
    })

    it.each(['unmount', 'flag-off'] as const)(
        '30b: a rejection settling after %s neither re-arms handlers nor forgets the grant',
        async (stop) => {
            installPermissionApi({ remembered: true })
            const pending = deferRequest()
            trackListeners()
            const handles = renderHook(() => useHomeShakeToPay())
            tap()
            stopHook(stop, handles)
            await act(async () => pending.reject(new Error('requires a user gesture')))
            await settlePermission()
            expect(liveArming()).toBe(0)
            expect(liveMotion()).toBe(0)
            expect(window.localStorage.getItem(grantKey)).toBe('1')
            tap()
            changeVisibility(false)
            changeVisibility(true)
            expect(permissionCalls).toHaveLength(1)
            expectNoNavigation()
        }
    )

    it('30c: an explicit denial clears the stored grant, never listens and never prompts again', async () => {
        installPermissionApi({ remembered: true, answer: 'denied' })
        trackListeners()
        renderHook(() => useHomeShakeToPay())
        tap()
        await settlePermission()
        expect(permissionCalls.filter(Boolean)).toHaveLength(1)
        expect(window.localStorage.getItem(grantKey)).toBeNull()
        expect(liveMotion()).toBe(0)
        const calls = permissionCalls.length
        tap()
        tap({ activated: false })
        changeVisibility(false)
        changeVisibility(true)
        tap()
        await settlePermission()
        dispatch(gesture(60, 'vigorous'))
        expect(permissionCalls).toHaveLength(calls)
        expect(liveMotion()).toBe(0)
        expect(window.localStorage.getItem(grantKey)).toBeNull()
        expectNoNavigation()
    })

    it('30c: a denial already in force is honoured and the stale remembered grant is cleared', async () => {
        installPermissionApi({ remembered: true, state: 'denied' })
        trackListeners()
        renderHook(() => useHomeShakeToPay())
        tap()
        await settlePermission()
        const calls = permissionCalls.length
        expect(window.localStorage.getItem(grantKey)).toBeNull()
        tap()
        changeVisibility(false)
        changeVisibility(true)
        tap()
        await settlePermission()
        dispatch(gesture(60, 'vigorous'))
        expect(permissionCalls).toHaveLength(calls)
        expect(liveMotion()).toBe(0)
        expectNoNavigation()
    })

    it('remains off without retry when the prompt is dismissed with default', async () => {
        installPermissionApi({ remembered: true })
        mockRequestPermission.mockImplementation(() => {
            permissionCalls.push(inActivation)
            return Promise.resolve('default')
        })
        trackListeners()
        renderHook(() => useHomeShakeToPay())
        tap()
        await settlePermission()
        tap()
        changeVisibility(false)
        changeVisibility(true)
        tap()
        dispatch(gesture(60, 'vigorous'))
        expect(permissionCalls).toHaveLength(1)
        expect(liveMotion()).toBe(0)
        expectNoNavigation()
        expect(window.localStorage.getItem(grantKey)).toBe('1')
    })

    it('30d: with permission already granted, listening is on after the first tap and nothing prompts again', async () => {
        installPermissionApi({ remembered: true, state: 'granted' })
        trackListeners()
        renderHook(() => useHomeShakeToPay())
        tap()
        await settlePermission()
        expect(liveMotion()).toBe(1)
        dispatch(gesture(60, 'vigorous'))
        expectNavigation()
        const calls = permissionCalls.length
        tap()
        changeVisibility(false)
        changeVisibility(true)
        tap()
        await settlePermission()
        dispatch(laterGesture())
        expect(permissionCalls).toHaveLength(calls)
        expect(liveMotion()).toBe(1)
        expect(window.localStorage.getItem(grantKey)).toBe('1')
    })

    it('30d: with permission already granted and no remembered grant, Home stays off', async () => {
        installPermissionApi({ state: 'granted' })
        trackListeners()
        renderHook(() => useHomeShakeToPay())
        tap()
        await settlePermission()
        dispatch(gesture(60, 'vigorous'))
        expect(permissionCalls).toEqual([])
        expect(liveMotion()).toBe(0)
        expectNoNavigation()
    })

    it.each(['unmount', 'flag-off', 'router-change'] as const)(
        '30e: removes every arming handler on %s, including after a re-arm, and stale callbacks stay inert',
        async (stop) => {
            installPermissionApi({ remembered: true })
            const handlesTracker = trackListeners()
            const handles = renderHook(() => useHomeShakeToPay())
            tap({ activated: false })
            await settlePermission()
            const before = handlesTracker.registrations.filter(
                (entry) => armingTypes.has(entry.type) && eventPath().includes(entry.target)
            )
            expect(before.length).toBeGreaterThan(0)
            const calls = permissionCalls.length
            stopHook(stop, handles)
            const stale = before.filter((entry) => !entry.removed && !entry.consumed)
            expect(stale).toEqual([])
            if (stop !== 'router-change') expect(liveArming()).toBe(0)
            act(() => {
                inActivation = true
                try {
                    before.forEach((entry) => callHandler(entry.handler, new Event(entry.type)))
                } finally {
                    inActivation = false
                }
            })
            await settlePermission()
            expect(permissionCalls).toHaveLength(calls)
            expect(liveMotion()).toBe(0)
            expectNoNavigation()
        }
    )

    it.each(['unmount', 'flag-off', 'router-change'] as const)(
        'ignores a deferred grant resolving after %s',
        async (stop) => {
            installPermissionApi({ remembered: true })
            const pending = deferRequest()
            trackListeners()
            const handles = renderHook(() => useHomeShakeToPay())
            tap()
            expect(permissionCalls).toEqual([true])
            const firstRouter = mockRouter
            stopHook(stop, handles)
            await act(async () => pending.resolve('granted'))
            changeVisibility(false)
            changeVisibility(true)
            dispatch(gesture(60, 'vigorous'))
            expect(liveMotion()).toBe(0)
            expect(firstRouter.push).not.toHaveBeenCalled()
            expect(mockRouter.push).not.toHaveBeenCalled()
            expect(mockHaptic).not.toHaveBeenCalled()
            expect(permissionCalls).toEqual([true])
        }
    )

    it('does not attach when a grant resolves while hidden and attaches on the next visible event', async () => {
        installPermissionApi({ remembered: true })
        const pending = deferRequest()
        trackListeners()
        renderHook(() => useHomeShakeToPay())
        tap()
        changeVisibility(false)
        await act(async () => pending.resolve('granted'))
        expect(liveMotion()).toBe(0)
        dispatch(gesture(60, 'vigorous'))
        expect(mockPush).not.toHaveBeenCalled()
        changeVisibility(true)
        dispatch(gesture(60, 'vigorous'))
        expectNavigation()
        expect(permissionCalls).toHaveLength(1)
    })

    it('keeps a pending request single through repeated taps and visibility cycles', () => {
        installPermissionApi({ remembered: true })
        mockRequestPermission.mockImplementation(() => {
            permissionCalls.push(inActivation)
            return new Promise(() => {})
        })
        trackListeners()
        renderHook(() => useHomeShakeToPay())
        tap()
        for (let index = 0; index < 5; index++) {
            changeVisibility(false)
            changeVisibility(true)
            tap()
            dispatch(laterGesture(index * 10000))
        }
        expect(permissionCalls).toEqual([true])
        expect(liveMotion()).toBe(0)
        expectNoNavigation()
    })

    it('30e: removes granted motion and visibility handlers on unmount', async () => {
        installPermissionApi({ remembered: true })
        const handlesTracker = trackListeners()
        const { unmount } = renderHook(() => useHomeShakeToPay())
        tap()
        await settlePermission()
        const motion = handlesTracker.registrations.find((entry) => entry.type === 'devicemotion')
        const visibility = handlesTracker.registrations.find(
            (entry) => entry.type === 'visibilitychange' && entry.target === document
        )
        expect(motion).toBeDefined()
        expect(visibility).toBeDefined()
        unmount()
        expect(liveMotion()).toBe(0)
        expect(liveVisibility()).toBe(0)
        expect(liveArming()).toBe(0)
        act(() => {
            gesture(60, 'vigorous').forEach((event) => callHandler(motion!.handler, event))
            callHandler(visibility!.handler, new Event('visibilitychange'))
        })
        expectNoNavigation()
        expect(handlesTracker.registrations.filter((entry) => entry.type === 'devicemotion')).toHaveLength(1)
    })

    it('30e: StrictMode keeps the same live handler set as a normal mount and one tap makes one request', async () => {
        installPermissionApi({ remembered: true })
        trackListeners()
        const plain = renderHook(() => useHomeShakeToPay())
        const plainArming = liveArming()
        plain.unmount()
        tracker = null
        trackListeners()
        renderHook(() => useHomeShakeToPay(), { wrapper: ({ children }) => <StrictMode>{children}</StrictMode> })
        expect(plainArming).toBeGreaterThan(0)
        expect(liveArming()).toBe(plainArming)
        tap()
        tap()
        await settlePermission()
        expect(permissionCalls.filter(Boolean)).toHaveLength(1)
        expect(liveMotion()).toBe(1)
        dispatch(gesture(60, 'vigorous'))
        expectNavigation()
    })

    it.each(['getter', 'getItem'] as const)('fails closed when the storage %s throws', async (fault) => {
        installPermissionApi({ remembered: true })
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
        trackListeners()
        expect(() => renderHook(() => useHomeShakeToPay())).not.toThrow()
        tap()
        changeVisibility(false)
        changeVisibility(true)
        await settlePermission()
        dispatch(gesture(60, 'vigorous'))
        expectNoNavigation()
        expect(permissionCalls).toEqual([])
        expect(liveMotion()).toBe(0)
    })

    it('stays off if forgetting denied consent cannot write storage', async () => {
        installPermissionApi({ remembered: true, answer: 'denied' })
        jest.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
            throw new Error('Storage removal failed')
        })
        trackListeners()
        renderHook(() => useHomeShakeToPay())
        tap()
        await settlePermission()
        const calls = permissionCalls.length
        expect(calls).toBeGreaterThan(0)
        tap()
        changeVisibility(false)
        changeVisibility(true)
        tap()
        await settlePermission()
        dispatch(gesture(60, 'vigorous'))
        expect(permissionCalls).toHaveLength(calls)
        expect(liveMotion()).toBe(0)
        expectNoNavigation()
    })

    it('does not install arming handlers or request permission when the flag is disabled', async () => {
        installPermissionApi({ remembered: true })
        mockFlagEnabled = false
        trackListeners()
        renderHook(() => useHomeShakeToPay())
        expect(liveArming()).toBe(0)
        tap()
        await settlePermission()
        expect(permissionCalls).toEqual([])
        expectNoNavigation()
    })
})

describe('30f: Home without an iOS motion permission API', () => {
    it.each([
        ['no DeviceMotionEvent permission API', undefined],
        ['a non-function requestPermission', 'granted'],
    ])(
        'with %s, taps never request permission, install no arming handlers and shaking works at once',
        (_label, api) => {
            Object.defineProperty(window, 'DeviceMotionEvent', {
                configurable: true,
                value: Object.assign(function DeviceMotionEvent() {}, { requestPermission: api }),
            })
            window.localStorage.setItem(grantKey, '1')
            trackListeners()
            renderHook(() => useHomeShakeToPay())
            expect(liveArming()).toBe(0)
            expect(liveMotion()).toBe(1)
            tap()
            changeVisibility(false)
            changeVisibility(true)
            tap()
            dispatch(gesture(60, 'vigorous'))
            expectNavigation()
            expect(mockRequestPermission).not.toHaveBeenCalled()
            expect(permissionCalls).toEqual([])
        }
    )
})
