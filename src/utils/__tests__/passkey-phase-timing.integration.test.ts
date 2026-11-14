import type { CapacitorPasskeyPlugin } from '@capgo/capacitor-passkey'
import fc from 'fast-check'

jest.mock('@/utils/native-platform', () => require('@/test-utils/native-platform-mock').createNativePlatformMock())
let mockNative = true
jest.mock('@/utils/capacitor', () => ({ isCapacitor: () => mockNative, getNativeRpId: () => 'peanut.me' }))
jest.mock('@/constants/dev-tools.consts', () => ({ DEV_TOOLS_ENABLED: false }))
jest.mock('@sentry/nextjs', () => ({ addBreadcrumb: jest.fn() }))
jest.mock('@/utils/sentry-lazy', () => ({ addBreadcrumb: jest.fn(), captureException: jest.fn() }))
const mockCapture = jest.fn()
jest.mock('posthog-js', () => ({
    __esModule: true,
    default: { capture: (...args: unknown[]) => mockCapture(...args) },
}))
const mockNativeCall = jest.fn()
jest.mock('@/utils/native-capability', () => ({
    nativeCapability: () => ({ call: mockNativeCall, isSupportedPlatform: () => true }),
}))
jest.mock('@/utils/api-fetch', () => ({
    apiFetch: (path: string, init: RequestInit) => window.fetch(`https://api.test${path}`, init),
}))
jest.mock('@simplewebauthn/browser', () => ({
    startAuthentication: () => navigator.credentials.get({}),
    WebAuthnAbortService: { cancelCeremony: jest.fn() },
}))

const deferred = <T>() => {
    let resolve!: (value: T) => void
    let reject!: (reason: unknown) => void
    const promise = new Promise<T>((yes, no) => {
        resolve = yes
        reject = no
    })
    return { promise, resolve, reject }
}
const delay = <T>(ms: number, value: T) => new Promise<T>((resolve) => setTimeout(() => resolve(value), ms))
const response = (body: unknown): Response => {
    const result = { ok: true, status: 200, json: async () => body, clone: () => result }
    return result as unknown as Response
}
const events = (name = 'webauthn_ceremony') =>
    mockCapture.mock.calls.filter(([event]) => event === name).map(([, properties]) => properties)
const nativeGet = jest.fn()
const fetchMock = jest.fn()
let telemetry: typeof import('../webauthn-ceremony-telemetry')
let guard: typeof import('../passkeyCeremony.utils').guardPasskeyCeremony
let getStepUpToken: typeof import('@/services/step-up').getStepUpToken
let installControl: typeof import('../android-passkey-control').installAndroidPasskeyControl
let createNativeSignMessageCallback: typeof import('../native-webauthn').createNativeSignMessageCallback
let requestLocalUserPresence: typeof import('../app-lock').requestLocalUserPresence

beforeEach(() => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2026-11-12T12:00:00Z'))
    mockNative = true
    mockCapture.mockReset()
    mockNativeCall.mockReset().mockResolvedValue({ pluginVersion: '8.2.2-peanut.1', androidSdk: 33 })
    nativeGet.mockReset().mockResolvedValue({ id: 'credential' })
    fetchMock.mockReset().mockResolvedValue(response({ challenge: 'AQID' }))
    Object.defineProperty(navigator, 'credentials', {
        configurable: true,
        value: { get: nativeGet, create: nativeGet },
    })
    ;(globalThis as Record<string, unknown>).__capgoPasskeyShimInstalled = true
    window.fetch = fetchMock
    jest.isolateModules(() => {
        telemetry = require('../webauthn-ceremony-telemetry')
        guard = require('../passkeyCeremony.utils').guardPasskeyCeremony
        installControl = require('../android-passkey-control').installAndroidPasskeyControl
        getStepUpToken = require('@/services/step-up').getStepUpToken
        createNativeSignMessageCallback = require('../native-webauthn').createNativeSignMessageCallback
        requestLocalUserPresence = require('../app-lock').requestLocalUserPresence
        telemetry.clearCeremonyLog()
        telemetry.installCeremonyTelemetry()
        require('../passkey-auth-capture').installPasskeyVerifyCapture()
    })
})
afterEach(() => {
    jest.clearAllTimers()
    jest.useRealTimers()
    jest.restoreAllMocks()
})

describe('credential lookup excludes attempts that never invoked credentials', () => {
    it.each([
        ['create', 'registration'],
        ['get', 'user_op'],
    ] as const)('keeps failed options telemetry without returning a %s call for %s', async (kind, purpose) => {
        const startedAt = Date.now()
        const failure = Object.assign(new Error('options unavailable'), { name: 'PasskeyServerError' })
        fetchMock.mockImplementationOnce(async () => {
            await delay(4_321, undefined)
            throw failure
        })
        const attempt = telemetry
            .withCeremonyPurpose(purpose, () =>
                guard(async () => {
                    await window.fetch(`https://api.test/passkeys/${kind === 'create' ? 'register' : 'login'}/options`)
                    return navigator.credentials[kind]({})
                })
            )
            .catch((error) => error)
        await jest.advanceTimersByTimeAsync(4_321)
        await expect(attempt).resolves.toBe(failure)
        expect(nativeGet).not.toHaveBeenCalled()
        expect(events()).toEqual([
            expect.objectContaining({ purpose, outcome: 'error', options_ms: 4_321, total_ms: 4_321 }),
        ])
        expect(events()[0]).not.toHaveProperty('timeout_phase')
        expect(telemetry.latestCeremony(kind, purpose, startedAt)).toBeUndefined()
    })

    it.each([
        ['create', 'registration'],
        ['get', 'user_op'],
    ] as const)('keeps an options timeout without returning a %s call for %s', async (kind, purpose) => {
        const startedAt = Date.now()
        fetchMock.mockReturnValueOnce(new Promise(() => {}))
        const attempt = telemetry
            .withCeremonyPurpose(purpose, () =>
                guard(async () => {
                    await window.fetch(`https://api.test/passkeys/${kind === 'create' ? 'register' : 'login'}/options`)
                    return navigator.credentials[kind]({})
                })
            )
            .catch((error) => error)
        await jest.advanceTimersByTimeAsync(60_000)
        await expect(attempt).resolves.toMatchObject({ name: 'CeremonyTimeoutError' })
        expect(nativeGet).not.toHaveBeenCalled()
        expect(events()).toEqual([
            expect.objectContaining({
                purpose,
                outcome: 'error',
                options_ms: 60_000,
                total_ms: 60_000,
                timeout_phase: 'options',
            }),
        ])
        expect(telemetry.latestCeremony(kind, purpose, startedAt)).toBeUndefined()
    })

    it.each([
        ['create', 'registration'],
        ['get', 'user_op'],
    ] as const)(
        'finds an earlier actual %s behind a newer %s fallback within the since bound',
        async (kind, purpose) => {
            const startedAt = Date.now()
            nativeGet.mockImplementationOnce(() => delay(37, { id: 'actual' }))
            const actual = telemetry.withCeremonyPurpose(purpose, () => guard(() => navigator.credentials[kind]({})))
            await jest.advanceTimersByTimeAsync(37)
            await actual
            const record = telemetry.latestCeremony(kind, purpose, startedAt)
            expect(record).toMatchObject({ kind, purpose, durationMs: 37 })
            await jest.advanceTimersByTimeAsync(1)
            const retryStartedAt = Date.now()
            await expect(
                telemetry.withCeremonyPurpose(purpose, () =>
                    guard(async () => {
                        throw new Error('before credentials')
                    })
                )
            ).rejects.toThrow('before credentials')
            expect(events()).toHaveLength(2)
            expect(nativeGet).toHaveBeenCalledTimes(1)
            expect(telemetry.latestCeremony(kind, purpose, startedAt)).toEqual(record)
            expect(telemetry.latestCeremony(kind, purpose, retryStartedAt)).toBeUndefined()
            expect(telemetry.latestCeremony(kind === 'create' ? 'get' : 'create', purpose, startedAt)).toBeUndefined()
            expect(telemetry.latestCeremony(kind, 'login', startedAt)).toBeUndefined()
        }
    )

    it('preserves actual create sheet duration and refusal metadata after slow options', async () => {
        const startedAt = Date.now()
        const refusal = Object.assign(new Error('incompatible provider'), {
            name: 'PasskeyProviderUnsupportedError',
            code: 'PASSKEY_PROVIDER_UNSUPPORTED',
            challengeOffset: 41,
            backupEligible: false,
        })
        fetchMock.mockImplementationOnce(() => delay(4_000, response({ challenge: 'AQID' })))
        nativeGet.mockImplementationOnce(async () => {
            await delay(275, undefined)
            throw refusal
        })
        const attempt = telemetry
            .withCeremonyPurpose('registration', () =>
                guard(async () => {
                    await window.fetch('https://api.test/passkeys/register/options')
                    return navigator.credentials.create({})
                })
            )
            .catch((error) => error)
        await jest.advanceTimersByTimeAsync(4_275)
        await expect(attempt).resolves.toBe(refusal)
        expect(telemetry.latestCeremony('create', 'registration', startedAt)).toMatchObject({
            kind: 'create',
            durationMs: 275,
            outcome: 'error',
            errorName: 'PasskeyProviderUnsupportedError',
            challengeOffset: 41,
            backupEligible: false,
        })
        expect(events()).toEqual([
            expect.objectContaining({ options_ms: 4_000, native_ms: 275, total_ms: 4_275, challenge_offset: 41 }),
        ])
    })

    it('still returns an actual credential call that remains pending at the guard timeout', async () => {
        const startedAt = Date.now()
        nativeGet.mockReturnValueOnce(new Promise(() => {}))
        const attempt = telemetry
            .withCeremonyPurpose('registration', () => guard(() => navigator.credentials.create({})))
            .catch((error) => error)
        await jest.advanceTimersByTimeAsync(60_000)
        await expect(attempt).resolves.toMatchObject({ name: 'CeremonyTimeoutError' })
        expect(nativeGet).toHaveBeenCalledTimes(1)
        expect(events()).toEqual([
            expect.objectContaining({ total_ms: 60_000, native_ms: null, timeout_phase: 'native' }),
        ])
        expect(telemetry.latestCeremony('create', 'registration', startedAt)).toMatchObject({ kind: 'create' })
    })
})

it.each(['success', 'error'] as const)(
    'joins Android late %s to the timeout without another outcome',
    async (outcome) => {
        const late = deferred<unknown>()
        const plugin = {
            getCredential: jest.fn(() => late.promise),
            createCredential: jest.fn(),
        } as unknown as CapacitorPasskeyPlugin
        installControl(plugin)
        nativeGet.mockImplementation((options) => plugin.getCredential(options))
        const result = telemetry
            .withCeremonyFlow('login', () =>
                telemetry.withCeremonyPurpose('login', () => guard(() => navigator.credentials.get({})))
            )
            .catch((error) => error)
        await jest.advanceTimersByTimeAsync(60_000)
        await expect(result).resolves.toMatchObject({ name: 'CeremonyTimeoutError' })
        expect(events()).toHaveLength(1)
        const timeout = events()[0]
        expect(timeout).toMatchObject({
            native_ms: null,
            timeout_phase: 'native',
            flow_id: expect.any(String),
            attempt_id: expect.any(String),
        })
        expect(timeout).not.toHaveProperty('native_settled_after_timeout')
        const frozen = JSON.stringify(timeout)
        if (outcome === 'success') late.resolve({ id: 'late' })
        else late.reject(new Error('late error'))
        await jest.advanceTimersByTimeAsync(0)
        const lifecycle = events('passkey_native_lifecycle').filter((event) => event.phase === 'late_settlement')
        expect(lifecycle).toEqual([
            expect.objectContaining({
                attempt_id: timeout.attempt_id,
                native_settled_after_timeout: true,
                lateOutcome: outcome,
            }),
        ])
        expect(events()).toHaveLength(1)
        expect(JSON.stringify(events()[0])).toBe(frozen)
    }
)

it('a conflicting same-message Android sign cannot replace the admitted attempt correlation', async () => {
    const late = deferred<unknown>()
    const plugin = {
        getCredential: jest.fn(() => late.promise),
        createCredential: jest.fn(),
    } as unknown as CapacitorPasskeyPlugin
    installControl(plugin)
    nativeGet.mockImplementation((options) => plugin.getCredential(options))
    const sign = createNativeSignMessageCallback('peanut.me')
    const first = telemetry
        .withCeremonyPurpose('user_op', () => sign('0xdeadbeef', 'peanut.me', 8453))
        .catch((error) => error)
    const second = telemetry
        .withCeremonyPurpose('user_op', () => sign('0xdeadbeef', 'peanut.me', 8453))
        .catch((error) => error)
    await jest.advanceTimersByTimeAsync(0)
    await expect(second).resolves.toMatchObject({ name: 'CeremonyConflictError' })
    await jest.advanceTimersByTimeAsync(60_000)
    await expect(first).resolves.toMatchObject({ name: 'CeremonyTimeoutError' })
    expect(events()).toHaveLength(1)
    expect(events()[0]).toMatchObject({ timeout_phase: 'native', native_ms: null })
    late.resolve({ id: 'late' })
    await jest.advanceTimersByTimeAsync(0)
    expect(events('passkey_native_lifecycle')).toContainEqual(
        expect.objectContaining({ phase: 'late_settlement', attempt_id: events()[0].attempt_id })
    )
    expect(events()).toHaveLength(1)
})

it('keeps the web guard at 300 seconds and reports its pending native phase', async () => {
    mockNative = false
    nativeGet.mockReturnValue(new Promise(() => {}))
    const result = guard(() => navigator.credentials.get({})).catch((error) => error)
    await jest.advanceTimersByTimeAsync(299_999)
    expect(events()).toHaveLength(0)
    await jest.advanceTimersByTimeAsync(1)
    await expect(result).resolves.toMatchObject({ name: 'CeremonyTimeoutError' })
    expect(events()).toEqual([
        expect.objectContaining({ native: false, total_ms: 300_000, timeout_phase: 'native', native_ms: null }),
    ])
})

it.each(['user_op', 'session_key_grant', 'admin_eip712', 'kernel_migration', 'ephemeral_enable'] as const)(
    'reports legacy native signing timeout for %s without a late second event',
    async (purpose) => {
        const late = deferred<Credential | null>()
        nativeGet.mockReturnValueOnce(late.promise)
        const result = telemetry
            .withCeremonyPurpose(purpose, () =>
                createNativeSignMessageCallback('peanut.me')('0xdeadbeef', 'peanut.me', 8453)
            )
            .catch((error) => error)
        await jest.advanceTimersByTimeAsync(60_000)
        await expect(result).resolves.toMatchObject({ name: 'CeremonyTimeoutError' })
        expect(events()).toEqual([
            expect.objectContaining({
                purpose,
                native_ms: null,
                options_ms: null,
                verify_ms: null,
                total_ms: 60_000,
                timeout_phase: 'native',
            }),
        ])
        late.resolve({ id: 'late' } as Credential)
        await jest.advanceTimersByTimeAsync(0)
        expect(events()).toHaveLength(1)
    }
)

it.each([true, false])('keeps local app-lock timeout behavior with native=%s', async (native) => {
    mockNative = native
    const descriptor = Object.getOwnPropertyDescriptor(window, 'PublicKeyCredential')
    Object.defineProperty(window, 'PublicKeyCredential', { configurable: true, value: jest.fn() })
    try {
        const late = deferred<Credential | null>()
        nativeGet.mockReturnValueOnce(late.promise)
        const result = requestLocalUserPresence('AQID')
        await jest.advanceTimersByTimeAsync(60_000)
        await expect(result).resolves.toBe('dismissed')
        expect(events()).toEqual([
            expect.objectContaining({
                purpose: 'app_lock',
                native,
                native_ms: null,
                total_ms: 60_000,
                timeout_phase: 'native',
            }),
        ])
        late.resolve({ id: 'late' } as Credential)
        await jest.advanceTimersByTimeAsync(0)
        expect(events()).toHaveLength(1)
    } finally {
        if (descriptor) Object.defineProperty(window, 'PublicKeyCredential', descriptor)
        else Reflect.deleteProperty(window, 'PublicKeyCredential')
    }
})

it('measures step-up options and verify without extending its credential-only guard', async () => {
    fetchMock.mockImplementation((url) =>
        String(url).endsWith('/options')
            ? delay(61_000, response({ challenge: 'AQID' }))
            : delay(62_000, response({ token: 'proof', expiresIn: 300 }))
    )
    nativeGet.mockImplementation(() => delay(200, { id: 'credential' }))
    const result = getStepUpToken()
    await jest.advanceTimersByTimeAsync(123_200)
    await expect(result).resolves.toBe('proof')
    expect(events()).toEqual([
        expect.objectContaining({
            purpose: 'step_up',
            options_ms: 61_000,
            native_ms: 200,
            verify_ms: 62_000,
            total_ms: 123_200,
        }),
    ])
    expect(events()[0]).not.toHaveProperty('timeout_phase')
})

it('attributes a retired web SDK continuation by its challenge and credential during a retry', async () => {
    mockNative = false
    const oldOptions = deferred<Response>()
    const newOptions = deferred<Response>()
    const oldNative = deferred<Credential | null>()
    const newNative = deferred<Credential | null>()
    fetchMock
        .mockReturnValueOnce(oldOptions.promise)
        .mockReturnValueOnce(newOptions.promise)
        .mockResolvedValue(response({}))
    nativeGet.mockReturnValueOnce(oldNative.promise).mockReturnValueOnce(newNative.promise)
    const login = async () => {
        const options = await (await window.fetch('https://api.test/passkeys/login/options')).json()
        const credential = await navigator.credentials.get({
            publicKey: { challenge: new Uint8Array([options.marker]) },
        })
        await window.fetch('https://api.test/passkeys/login/verify', {
            body: JSON.stringify({
                cred: {
                    ...credential,
                    response: { clientDataJSON: btoa(JSON.stringify({ challenge: options.challenge })) },
                },
            }),
            method: 'POST',
        })
    }
    const first = telemetry.withCeremonyPurpose('login', () => guard(login)).catch((error) => error)
    await jest.advanceTimersByTimeAsync(300_000)
    await expect(first).resolves.toMatchObject({ name: 'CeremonyTimeoutError' })
    const frozen = JSON.stringify(events()[0])
    const second = telemetry.withCeremonyPurpose('login', () => guard(login))
    oldOptions.resolve(response({ challenge: 'AQ', marker: 1 }))
    await jest.advanceTimersByTimeAsync(10)
    newOptions.resolve(response({ challenge: 'Ag', marker: 2 }))
    await jest.advanceTimersByTimeAsync(20)
    oldNative.resolve({ id: 'same-passkey' } as Credential)
    await jest.advanceTimersByTimeAsync(30)
    newNative.resolve({ id: 'same-passkey' } as Credential)
    await second
    expect(events()).toHaveLength(2)
    expect(JSON.stringify(events()[0])).toBe(frozen)
    expect(events()[1]).toMatchObject({ options_ms: 10, native_ms: 50, verify_ms: 0, total_ms: 60 })
    expect(events()[1].attempt_id).not.toBe(events()[0].attempt_id)
})

it('does not attribute an evicted old challenge to a live retry', async () => {
    mockNative = false
    const gates = Array.from({ length: 42 }, () => deferred<void>())
    const login = (marker: number) => async () => {
        const challenge = btoa(String.fromCharCode(marker)).replace(/=+$/, '')
        fetchMock.mockResolvedValueOnce(response({ challenge }))
        const options = await (await window.fetch('https://api.test/passkeys/login/options')).json()
        await gates[marker - 1].promise
        return navigator.credentials.get({
            publicKey: { challenge: new Uint8Array([atob(options.challenge).charCodeAt(0)]) },
        })
    }
    for (let marker = 1; marker <= 41; marker++) {
        const result = telemetry.withCeremonyPurpose('login', () => guard(login(marker))).catch((error) => error)
        await jest.advanceTimersByTimeAsync(300_000)
        await expect(result).resolves.toMatchObject({ name: 'CeremonyTimeoutError' })
    }
    nativeGet.mockImplementation(() => delay(50, { id: 'same-passkey' }))
    const result = telemetry.withCeremonyPurpose('login', () => guard(login(42)))
    await jest.advanceTimersByTimeAsync(0)
    gates[0].resolve()
    await jest.advanceTimersByTimeAsync(100)
    expect(events()).toHaveLength(41)
    gates[41].resolve()
    await jest.advanceTimersByTimeAsync(50)
    await result
    expect(events()).toHaveLength(42)
    expect(events()[41]).toMatchObject({ native_ms: 50, options_ms: 0, total_ms: 150 })
})

it('a cancelled pre-native continuation cannot borrow a retry timing', async () => {
    mockNative = false
    const gate = deferred<void>()
    const liveNative = deferred<Credential | null>()
    const cancel = new AbortController()
    const old = guard(
        async () => {
            await gate.promise
            return navigator.credentials.get({ publicKey: { challenge: new Uint8Array([1]) } })
        },
        { cancel: cancel.signal }
    ).catch((error) => error)
    cancel.abort()
    await expect(old).resolves.toMatchObject({ name: 'CeremonyCancelledError' })
    const frozen = JSON.stringify(events()[0])
    nativeGet.mockReturnValueOnce(liveNative.promise).mockImplementation(() => delay(50, { id: 'old' }))
    fetchMock.mockResolvedValueOnce(response({ challenge: 'Ag' }))
    const live = guard(async () => {
        await (await window.fetch('https://api.test/passkeys/login/options')).json()
        return navigator.credentials.get({ publicKey: { challenge: new Uint8Array([2]) } })
    })
    await jest.advanceTimersByTimeAsync(0)
    gate.resolve()
    await jest.advanceTimersByTimeAsync(200)
    liveNative.resolve({ id: 'live' } as Credential)
    await live
    expect(events()).toHaveLength(2)
    expect(JSON.stringify(events()[0])).toBe(frozen)
    expect(events()[1]).toMatchObject({ native_ms: 200, total_ms: 200, options_ms: 0 })
})

it('counts hidden intervals once and freezes outcomes across a seeded transition corpus', () => {
    const descriptor = Object.getOwnPropertyDescriptor(document, 'hidden')
    let hidden = false
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden })
    try {
        const workloads = fc.sample(
            fc.array(fc.tuple(fc.integer({ min: 0, max: 10_000 }), fc.boolean()), { maxLength: 16 }),
            { seed: 0x15ab3, numRuns: 32 }
        )
        for (const workload of workloads) {
            hidden = false
            const before = events().length
            const timing = telemetry.beginCeremonyTiming(Date.now(), 'user_op')
            timing.activate()
            const done = timing.phase('native')
            let total = 0
            let backgrounded = 0
            for (const [ms, nextHidden] of workload) {
                total += ms
                if (hidden) backgrounded += ms
                jest.setSystemTime(Date.now() + ms)
                hidden = nextHidden
                document.dispatchEvent(new Event('visibilitychange'))
            }
            done()
            timing.operationSettled()
            timing.finish()
            const event = events()[before]
            expect(event).toMatchObject({ total_ms: total, native_ms: total, backgrounded_ms: backgrounded })
            const frozen = JSON.stringify(event)
            timing.timeout()
            timing.finish(new Error('late'))
            timing.dispose()
            expect(events()).toHaveLength(before + 1)
            expect(JSON.stringify(events()[before])).toBe(frozen)
        }
    } finally {
        if (descriptor) Object.defineProperty(document, 'hidden', descriptor)
        else Reflect.deleteProperty(document, 'hidden')
    }
})
