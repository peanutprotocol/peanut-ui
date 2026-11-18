import type { CeremonyTiming } from '@/utils/webauthn-ceremony-telemetry'

let mockNativeInFlight = false
let mockSetAppActive: ((isActive: boolean) => void) | undefined
const mockStopWatching = jest.fn()

jest.mock('@/utils/capacitor', () => ({ isCapacitor: () => true }))
jest.mock('@/utils/auth-token', () => ({ setAuthToken: jest.fn() }))
jest.mock('@/utils/sentry-lazy', () => ({ captureException: jest.fn(), addBreadcrumb: jest.fn() }))
jest.mock('@/services/step-up-cache', () => ({ setCachedStepUpToken: jest.fn() }))
jest.mock('@/utils/webauthn-ceremony-telemetry', () => ({
    openCredentialCall: () => ({ inFlight: mockNativeInFlight }),
}))
jest.mock('@/utils/native-app-state', () => ({
    watchNativeAppActive: (onChange: (isActive: boolean) => void) => {
        mockSetAppActive = onChange
        return mockStopWatching
    },
}))

function deferred<T>() {
    let resolve!: (value: T) => void
    const promise = new Promise<T>((yes) => {
        resolve = yes
    })
    return { promise, resolve }
}

const outcome = <T>(promise: Promise<T>) =>
    promise.then(
        (value) => ({ value }),
        (error: Error & { outcome?: string }) => ({ error })
    )

const fakeTiming = () =>
    ({
        activate: jest.fn(),
        operationStarted: jest.fn(),
        operationSettled: jest.fn(),
        timeout: jest.fn(),
        finish: jest.fn(),
        dispose: jest.fn(),
    }) as unknown as CeremonyTiming & { timeout: jest.Mock }

async function setup() {
    jest.resetModules()
    ;(globalThis as Record<string, unknown>).__capgoPasskeyShimInstalled = true
    const scopes = await import('../android-passkey-scope')
    scopes.enableAndroidPasskeyScopes()
    const ceremony = await import('../passkeyCeremony.utils')
    const scope = () => scopes.currentAndroidPasskeyScope()
    return { ...ceremony, scope }
}

beforeEach(() => {
    jest.useFakeTimers()
    mockNativeInFlight = false
    mockSetAppActive = undefined
    mockStopWatching.mockReset()
})
afterEach(() => {
    jest.clearAllTimers()
    jest.useRealTimers()
    delete (globalThis as Record<string, unknown>).__capgoPasskeyShimInstalled
})

describe('guardPasskeyCeremony on Android', () => {
    it('does not time out at 60 s while the native sheet is pending in the foreground', async () => {
        const { guardPasskeyCeremony } = await setup()
        const sheet = deferred<string>()
        mockNativeInFlight = true
        const result = outcome(guardPasskeyCeremony(() => sheet.promise))
        await jest.advanceTimersByTimeAsync(120_000)
        sheet.resolve('credential')
        await expect(result).resolves.toEqual({ value: 'credential' })
        expect(mockStopWatching).toHaveBeenCalled()
    })

    it('fires sheet_hung at the hung bound when the app stayed in front', async () => {
        const { guardPasskeyCeremony, ANDROID_SHEET_HUNG_MS, CeremonyTimeoutError, isCeremonyGuardError, scope } =
            await setup()
        mockNativeInFlight = true
        const timing = fakeTiming()
        const result = outcome(guardPasskeyCeremony(() => new Promise<never>(() => {}), { timing }))
        await jest.advanceTimersByTimeAsync(ANDROID_SHEET_HUNG_MS - 1)
        expect(timing.timeout).not.toHaveBeenCalled()
        await jest.advanceTimersByTimeAsync(1)
        const { error } = (await result) as { error: InstanceType<typeof CeremonyTimeoutError> }
        expect(error).toBeInstanceOf(CeremonyTimeoutError)
        expect(error.outcome).toBe('sheet_hung')
        expect(isCeremonyGuardError(error)).toBe(true)
        expect(timing.timeout).toHaveBeenCalledWith('sheet_hung')
        // The scope expiry is what cancels the native request and fences its late result.
        expect(scope()?.expired).toBe(true)
    })

    it('keeps the 60 s bound while no native request is pending (options or verify hang)', async () => {
        const { guardPasskeyCeremony, CEREMONY_TIMEOUT_MS } = await setup()
        const result = outcome(guardPasskeyCeremony(() => new Promise<never>(() => {})))
        await jest.advanceTimersByTimeAsync(CEREMONY_TIMEOUT_MS)
        await expect(result).resolves.toMatchObject({
            error: { name: 'CeremonyTimeoutError', outcome: 'network_hung' },
        })
    })

    it('gives the network after the sheet its own 60 s, not the rest of the sheet bound', async () => {
        const { guardPasskeyCeremony, CEREMONY_TIMEOUT_MS } = await setup()
        mockNativeInFlight = true
        const timing = fakeTiming()
        const result = outcome(guardPasskeyCeremony(() => new Promise<never>(() => {}), { timing }))
        await jest.advanceTimersByTimeAsync(70_000)
        // The sheet returns at 70 s; register/verify then hangs.
        mockNativeInFlight = false
        await jest.advanceTimersByTimeAsync(1_000 + CEREMONY_TIMEOUT_MS - 1)
        expect(timing.timeout).not.toHaveBeenCalled()
        await jest.advanceTimersByTimeAsync(1_000)
        await expect(result).resolves.toMatchObject({
            error: { name: 'CeremonyTimeoutError', outcome: 'network_hung' },
        })
        expect(timing.timeout).toHaveBeenCalledWith('network_hung')
    })

    it('sees a sheet that opens and closes before 60 s, and gives the network after it a full 60 s', async () => {
        const { guardPasskeyCeremony, CEREMONY_TIMEOUT_MS } = await setup()
        const timing = fakeTiming()
        const result = outcome(guardPasskeyCeremony(() => new Promise<never>(() => {}), { timing }))
        await jest.advanceTimersByTimeAsync(2_000)
        mockNativeInFlight = true
        await jest.advanceTimersByTimeAsync(18_000)
        // The sheet closes at 20 s; register/verify then hangs.
        mockNativeInFlight = false
        await jest.advanceTimersByTimeAsync(1_000 + CEREMONY_TIMEOUT_MS - 1)
        expect(timing.timeout).not.toHaveBeenCalled()
        await jest.advanceTimersByTimeAsync(1_000)
        await expect(result).resolves.toMatchObject({
            error: { name: 'CeremonyTimeoutError', outcome: 'network_hung' },
        })
    })

    it('pauses the deadline while the app is in the background', async () => {
        const { guardPasskeyCeremony } = await setup()
        const sheet = deferred<string>()
        mockNativeInFlight = true
        const result = outcome(guardPasskeyCeremony(() => sheet.promise))
        await jest.advanceTimersByTimeAsync(10_000)
        mockSetAppActive!(false)
        await jest.advanceTimersByTimeAsync(600_000)
        mockSetAppActive!(true)
        await jest.advanceTimersByTimeAsync(5_000)
        sheet.resolve('credential')
        await expect(result).resolves.toEqual({ value: 'credential' })
    })

    it('fires left_app when the ceremony does not settle within the grace after the person returns', async () => {
        const { guardPasskeyCeremony, ANDROID_RETURN_GRACE_MS } = await setup()
        mockNativeInFlight = true
        const timing = fakeTiming()
        const result = outcome(guardPasskeyCeremony(() => new Promise<never>(() => {}), { timing }))
        await jest.advanceTimersByTimeAsync(20_000)
        mockSetAppActive!(false)
        await jest.advanceTimersByTimeAsync(300_000)
        expect(timing.timeout).not.toHaveBeenCalled()
        mockSetAppActive!(true)
        await jest.advanceTimersByTimeAsync(ANDROID_RETURN_GRACE_MS - 1)
        expect(timing.timeout).not.toHaveBeenCalled()
        await jest.advanceTimersByTimeAsync(1)
        await expect(result).resolves.toMatchObject({ error: { name: 'CeremonyTimeoutError', outcome: 'left_app' } })
        expect(timing.timeout).toHaveBeenCalledWith('left_app')
    })

    it('the return grace never extends the foreground budget', async () => {
        const { guardPasskeyCeremony, ANDROID_SHEET_HUNG_MS } = await setup()
        mockNativeInFlight = true
        const result = outcome(guardPasskeyCeremony(() => new Promise<never>(() => {})))
        await jest.advanceTimersByTimeAsync(ANDROID_SHEET_HUNG_MS - 10_000)
        mockSetAppActive!(false)
        await jest.advanceTimersByTimeAsync(60_000)
        mockSetAppActive!(true)
        await jest.advanceTimersByTimeAsync(10_000)
        await expect(result).resolves.toMatchObject({ error: { outcome: 'left_app' } })
    })
})
