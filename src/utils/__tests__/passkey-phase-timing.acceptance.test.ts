export {}

jest.mock('@/utils/native-platform', () => require('@/test-utils/native-platform-mock').createNativePlatformMock())
jest.mock('@/utils/capacitor', () => ({ isCapacitor: () => true }))
jest.mock('@/constants/dev-tools.consts', () => ({ DEV_TOOLS_ENABLED: false }))
jest.mock('@sentry/nextjs', () => ({ addBreadcrumb: jest.fn() }))
jest.mock('@/utils/sentry-lazy', () => ({
    captureException: jest.fn(),
    withScope: jest.fn(),
    captureMessage: jest.fn(),
    addBreadcrumb: jest.fn(),
}))

const capture = jest.fn()
jest.mock('posthog-js', () => ({
    __esModule: true,
    default: { capture: (...args: unknown[]) => capture(...args) },
}))

function deferred<T>() {
    let resolve!: (value: T) => void
    let reject!: (reason: unknown) => void
    const promise = new Promise<T>((yes, no) => {
        resolve = yes
        reject = no
    })
    return { promise, resolve, reject }
}

const delay = <T>(ms: number, value: T) => new Promise<T>((resolve) => setTimeout(() => resolve(value), ms))
const observe = <T>(promise: Promise<T>) =>
    promise.then(
        (value) => ({ value }),
        (error) => ({ error })
    )
const events = () => capture.mock.calls.filter(([name]) => name === 'webauthn_ceremony').map(([, props]) => props)

function response(): Response {
    const result = {
        ok: true,
        status: 200,
        json: async () => ({ verification: { verified: true } }),
        text: async () => JSON.stringify({ verification: { verified: true } }),
        clone: () => result,
    }
    return result as unknown as Response
}

let guard: typeof import('../passkeyCeremony.utils').guardPasskeyCeremony
let purpose: typeof import('../webauthn-ceremony-telemetry').withCeremonyPurpose
const nativeGet = jest.fn()
const nativeCreate = jest.fn()
const fetchMock = jest.fn()
let hidden = false
const originalHidden = Object.getOwnPropertyDescriptor(document, 'hidden')
const originalVisibility = Object.getOwnPropertyDescriptor(document, 'visibilityState')

function visibility(value: boolean) {
    hidden = value
    document.dispatchEvent(new Event('visibilitychange'))
}

function expectSingle(fields: Record<string, unknown>) {
    expect(events()).toHaveLength(1)
    expect(events()[0]).toMatchObject({ attempt_id: expect.any(String), ...fields })
    expect(events()[0].attempt_id.length).toBeGreaterThan(0)
    expect(events()[0]).not.toHaveProperty('native_settled_after_timeout')
    return events()[0]
}

beforeEach(() => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2026-11-12T12:00:00Z'))
    capture.mockReset()
    nativeGet.mockReset().mockResolvedValue({ id: 'credential' })
    nativeCreate.mockReset().mockResolvedValue({ id: 'credential' })
    fetchMock.mockReset().mockImplementation(async () => response())
    hidden = false
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden })
    Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: () => (hidden ? 'hidden' : 'visible'),
    })
    Object.defineProperty(navigator, 'credentials', {
        configurable: true,
        value: { get: nativeGet, create: nativeCreate },
    })
    Object.defineProperty(window, '__capgoPasskeyShimInstalled', { configurable: true, writable: true, value: true })
    window.fetch = fetchMock
    jest.isolateModules(() => {
        const telemetry = require('../webauthn-ceremony-telemetry')
        guard = require('../passkeyCeremony.utils').guardPasskeyCeremony
        purpose = telemetry.withCeremonyPurpose
        telemetry.clearCeremonyLog()
        telemetry.installCeremonyTelemetry()
        require('../passkey-auth-capture').installPasskeyVerifyCapture()
    })
})

afterEach(() => {
    jest.clearAllTimers()
    jest.useRealTimers()
    jest.restoreAllMocks()
    if (originalHidden) Object.defineProperty(document, 'hidden', originalHidden)
    else Reflect.deleteProperty(document, 'hidden')
    if (originalVisibility) Object.defineProperty(document, 'visibilityState', originalVisibility)
    else Reflect.deleteProperty(document, 'visibilityState')
})

describe('passkey phase timing acceptance', () => {
    it.each([
        ['login', 'get'],
        ['register', 'create'],
    ] as const)(
        '%s success includes complete API/native durations and guard-entry total once',
        async (route, method) => {
            const credential = { id: 'result-credential' }
            const native = method === 'get' ? nativeGet : nativeCreate
            native.mockImplementationOnce(() => delay(230, credential))
            fetchMock.mockImplementation((input) => delay(String(input).endsWith('/options') ? 120 : 340, response()))
            const result = observe(
                guard(() =>
                    purpose(route === 'login' ? 'login' : 'registration', async () => {
                        await delay(70, undefined)
                        await window.fetch(`https://api.test.com/passkeys/${route}/options`, { method: 'POST' })
                        const value = await navigator.credentials[method]({})
                        await window.fetch(`https://api.test.com/passkeys/${route}/verify`, { method: 'POST' })
                        return value
                    })
                )
            )
            await jest.advanceTimersByTimeAsync(420)
            expect(events()).toHaveLength(0)
            await jest.advanceTimersByTimeAsync(340)
            await expect(result).resolves.toEqual({ value: credential })
            const event = expectSingle({
                outcome: 'ok',
                options_ms: 120,
                native_ms: 230,
                verify_ms: 340,
                total_ms: 760,
                backgrounded_ms: 0,
            })
            expect(event).not.toHaveProperty('timeout_phase')
        }
    )

    it.each(['options', 'native', 'verify'] as const)(
        'timeout in %s freezes reached durations and emits exactly once',
        async (phase) => {
            const pendingHttp = deferred<Response>()
            const pendingNative = deferred<Credential | null>()
            fetchMock.mockImplementation((input) => {
                const isOptions = String(input).endsWith('/options')
                if ((phase === 'options' && isOptions) || (phase === 'verify' && !isOptions)) return pendingHttp.promise
                return delay(100, response())
            })
            nativeGet.mockImplementation(() =>
                phase === 'native' ? pendingNative.promise : delay(200, { id: 'credential' })
            )
            const result = observe(
                guard(() =>
                    purpose('login', async () => {
                        await window.fetch('https://api.test.com/passkeys/login/options', { method: 'POST' })
                        await navigator.credentials.get({})
                        await window.fetch('https://api.test.com/passkeys/login/verify', { method: 'POST' })
                    })
                )
            )
            await jest.advanceTimersByTimeAsync(59_999)
            expect(events()).toHaveLength(0)
            await jest.advanceTimersByTimeAsync(1)
            await expect(result).resolves.toEqual({ error: expect.any(Error) })
            const event = expectSingle({
                outcome: 'error',
                error_code: 'CEREMONY_TIMEOUT',
                timeout_phase: phase,
                options_ms: phase === 'options' ? 60_000 : 100,
                native_ms: phase === 'verify' ? 200 : null,
                verify_ms: phase === 'verify' ? 59_700 : null,
                total_ms: 60_000,
                backgrounded_ms: 0,
            })
            const frozen = JSON.stringify(event)
            pendingHttp.resolve(response())
            pendingNative.resolve({ id: 'late-credential' } as Credential)
            await jest.advanceTimersByTimeAsync(1_000)
            expect(events()).toHaveLength(1)
            expect(JSON.stringify(events()[0])).toBe(frozen)
        }
    )

    it('timeout outside known phases reports other with all unreached durations null', async () => {
        const result = observe(guard(() => new Promise<never>(() => {})))
        await jest.advanceTimersByTimeAsync(60_000)
        await expect(result).resolves.toEqual({ error: expect.any(Error) })
        expectSingle({
            error_code: 'CEREMONY_TIMEOUT',
            timeout_phase: 'other',
            options_ms: null,
            native_ms: null,
            verify_ms: null,
            total_ms: 60_000,
            backgrounded_ms: 0,
        })
    })

    it('overlapping tap preserves conflict rejection and the first attempt timings', async () => {
        const pending = deferred<Credential | null>()
        nativeGet.mockReturnValueOnce(pending.promise)
        const first = observe(guard(() => purpose('login', () => navigator.credentials.get({}))))
        await jest.advanceTimersByTimeAsync(100)
        const duplicate = jest.fn(async () => 'duplicate')
        await expect(guard(duplicate)).rejects.toMatchObject({ name: 'CeremonyConflictError' })
        expect(duplicate).not.toHaveBeenCalled()
        await jest.advanceTimersByTimeAsync(200)
        pending.resolve({ id: 'first' } as Credential)
        await expect(first).resolves.toEqual({ value: { id: 'first' } })
        expectSingle({
            outcome: 'ok',
            options_ms: null,
            native_ms: 300,
            verify_ms: null,
            total_ms: 300,
            backgrounded_ms: 0,
        })
    })

    it.each(['resolve', 'reject'] as const)(
        'retry stays independent when an abandoned native call later %s',
        async (settlement) => {
            const oldNative = deferred<Credential | null>()
            const newNative = deferred<Credential | null>()
            nativeGet.mockReturnValueOnce(oldNative.promise).mockReturnValueOnce(newNative.promise)
            const first = observe(guard(() => purpose('login', () => navigator.credentials.get({}))))
            await jest.advanceTimersByTimeAsync(60_000)
            await expect(first).resolves.toEqual({ error: expect.any(Error) })
            const firstEvent = expectSingle({
                error_code: 'CEREMONY_TIMEOUT',
                timeout_phase: 'native',
                native_ms: null,
                total_ms: 60_000,
            })
            const frozen = JSON.stringify(firstEvent)
            const second = observe(guard(() => purpose('login', () => navigator.credentials.get({}))))
            await jest.advanceTimersByTimeAsync(200)
            if (settlement === 'resolve') oldNative.resolve({ id: 'old' } as Credential)
            else oldNative.reject(new Error('old failure'))
            await jest.advanceTimersByTimeAsync(100)
            newNative.resolve({ id: 'new' } as Credential)
            await expect(second).resolves.toEqual({ value: { id: 'new' } })
            expect(events()).toHaveLength(2)
            expect(JSON.stringify(events()[0])).toBe(frozen)
            expect(events()[1]).toMatchObject({
                outcome: 'ok',
                native_ms: 300,
                total_ms: 300,
                options_ms: null,
                verify_ms: null,
                backgrounded_ms: 0,
            })
            expect(events()[1].attempt_id).toEqual(expect.any(String))
            expect(events()[1].attempt_id).not.toBe(firstEvent.attempt_id)
            expect(events()[1]).not.toHaveProperty('native_settled_after_timeout')
        }
    )

    it('accumulates repeated background intervals through timeout and removes its listener', async () => {
        const add = jest.spyOn(document, 'addEventListener')
        const remove = jest.spyOn(document, 'removeEventListener')
        nativeGet.mockReturnValueOnce(new Promise(() => {}))
        const result = observe(guard(() => purpose('login', () => navigator.credentials.get({}))))
        await jest.advanceTimersByTimeAsync(100)
        visibility(true)
        await jest.advanceTimersByTimeAsync(200)
        visibility(false)
        await jest.advanceTimersByTimeAsync(100)
        visibility(true)
        await jest.advanceTimersByTimeAsync(59_600)
        await expect(result).resolves.toEqual({ error: expect.any(Error) })
        const event = expectSingle({ error_code: 'CEREMONY_TIMEOUT', backgrounded_ms: 59_800, total_ms: 60_000 })
        const listeners = add.mock.calls.filter(([type]) => type === 'visibilitychange').map(([, listener]) => listener)
        expect(listeners.length).toBeGreaterThan(0)
        for (const listener of listeners) {
            expect(
                remove.mock.calls.some(([type, removed]) => type === 'visibilitychange' && removed === listener)
            ).toBe(true)
        }
        visibility(false)
        await jest.advanceTimersByTimeAsync(1_000)
        expect(event.backgrounded_ms).toBe(59_800)
        expect(events()).toHaveLength(1)
    })

    it.each(['success', 'error'] as const)(
        'a throwing telemetry sink preserves the original %s result',
        async (outcome) => {
            const error = Object.assign(new Error('native cancelled'), { name: 'NotAllowedError' })
            if (outcome === 'error') nativeGet.mockRejectedValueOnce(error)
            capture.mockImplementation(() => {
                throw new Error('telemetry unavailable')
            })
            const result = observe(guard(() => purpose('login', () => navigator.credentials.get({}))))
            await expect(result).resolves.toEqual(outcome === 'error' ? { error } : { value: { id: 'credential' } })
        }
    )

    it('phase metadata never exports credential or request identity material', async () => {
        const secrets = [
            'secret-challenge',
            'secret-credential-id',
            'secret-raw-id',
            'secret-user-handle',
            'secret-username',
            'https://secret-origin.test',
        ]
        nativeGet.mockResolvedValueOnce({
            id: secrets[1],
            rawId: new TextEncoder().encode(secrets[2]).buffer,
            response: {
                userHandle: new TextEncoder().encode(secrets[3]).buffer,
                clientDataJSON: new TextEncoder().encode(
                    JSON.stringify({ type: 'webauthn.get', challenge: secrets[0], origin: secrets[5] })
                ).buffer,
            },
        })
        await guard(() =>
            purpose('login', async () => {
                await window.fetch('https://api.test.com/passkeys/login/options', {
                    method: 'POST',
                    body: JSON.stringify({ username: secrets[4] }),
                })
                await navigator.credentials.get({ publicKey: { challenge: new TextEncoder().encode(secrets[0]) } })
                await window.fetch('https://api.test.com/passkeys/login/verify', {
                    method: 'POST',
                    body: JSON.stringify({ id: secrets[1] }),
                })
            })
        )
        expectSingle({ outcome: 'ok', options_ms: 0, native_ms: 0, verify_ms: 0, total_ms: 0, backgrounded_ms: 0 })
        const serialized = JSON.stringify(capture.mock.calls)
        for (const secret of secrets) expect(serialized).not.toContain(secret)
    })
})
