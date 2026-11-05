import type { CapacitorPasskeyPlugin } from '@capgo/capacitor-passkey'

const mockCall = jest.fn()
const mockSupported = jest.fn(() => true)
const mockCapture = jest.fn()
const mockBreadcrumb = jest.fn()
jest.mock('../native-capability', () => ({
    nativeCapability: () => ({ call: mockCall, isSupportedPlatform: mockSupported }),
}))
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: mockCapture } }))
jest.mock('../sentry-lazy', () => ({ addBreadcrumb: mockBreadcrumb }))

const deferred = <T>() => {
    let resolve!: (value: T) => void
    const promise = new Promise<T>((yes) => {
        resolve = yes
    })
    return { promise, resolve }
}
const pluginFixture = () => ({ getCredential: jest.fn(), createCredential: jest.fn() })

beforeEach(() => {
    jest.resetModules()
    jest.useFakeTimers()
    jest.clearAllMocks()
    mockSupported.mockReturnValue(true)
    mockCall.mockImplementation(async (method: string) =>
        method === 'cancelRequest'
            ? { cancelled: true, released: true, settled: false }
            : {
                  androidSdk: 36,
                  manufacturer: 'vivo',
                  model: 'V2227A',
                  pluginVersion: '8.2.2-peanut.2',
                  playServicesStatus: 'unknown',
                  challenge: 'secret',
              }
    )
})
afterEach(() => {
    jest.clearAllTimers()
    jest.useRealTimers()
})

const nativePending = () =>
    Object.assign(new Error('A passkey request is already pending.'), {
        code: 'InvalidStateError',
        data: { name: 'InvalidStateError' },
    })

it('shares native ownership across get/create and forwards a bounded request ID', async () => {
    const { installAndroidPasskeyControl, cancelActiveAndroidPasskeyRequest } =
        await import('../android-passkey-control')
    const pending = deferred<unknown>()
    const plugin = pluginFixture()
    const nativeGet = plugin.getCredential.mockReturnValue(pending.promise)
    const created = {
        response: {
            clientDataJSON: Buffer.from(
                JSON.stringify({
                    type: 'webauthn.create',
                    challenge: 'fixture',
                    origin: 'android:apk-key-hash:fixture',
                })
            ).toString('base64url'),
        },
    }
    const nativeCreate = plugin.createCredential.mockResolvedValue(created)
    installAndroidPasskeyControl(plugin as unknown as CapacitorPasskeyPlugin)
    installAndroidPasskeyControl(plugin as unknown as CapacitorPasskeyPlugin)
    await jest.advanceTimersByTimeAsync(0)
    const original = plugin.getCredential({ publicKey: { challenge: 'private' } }).catch((error: Error) => error)
    expect(nativeGet).toHaveBeenCalledTimes(1)
    const id = nativeGet.mock.calls[0][0].requestId
    expect(id).toMatch(/^[A-Za-z0-9_-]{1,64}$/)
    await expect(plugin.createCredential({})).rejects.toMatchObject({ name: 'CeremonyConflictError' })
    expect(nativeCreate).not.toHaveBeenCalled()
    cancelActiveAndroidPasskeyRequest()
    await expect(original).resolves.toMatchObject({ name: 'CeremonyTimeoutError' })
    expect(mockCall).toHaveBeenCalledWith('cancelRequest', { requestId: id }, expect.any(Function))
    await jest.advanceTimersByTimeAsync(0)
    // The new binary releases its slot on cancel: the next tap starts at once, with no restart.
    await expect(plugin.createCredential({})).resolves.toBe(created)
    expect(nativeCreate).toHaveBeenCalledTimes(1)
    expect(nativeCreate.mock.calls[0][0].requestId).not.toBe(id)
    pending.resolve('late credential')
    await jest.advanceTimersByTimeAsync(0)
    await expect(original).resolves.toMatchObject({ name: 'CeremonyTimeoutError' })
    expect(JSON.stringify(mockCapture.mock.calls)).not.toContain('private')
    expect(JSON.stringify(mockCapture.mock.calls)).not.toContain('secret')
})

it('emits allowlisted native error details, without delaying authentication', async () => {
    const { installAndroidPasskeyControl } = await import('../android-passkey-control')
    const plugin = pluginFixture()
    const failure = Object.assign(new Error('credential SECRET'), {
        code: 'NotFoundError',
        data: { nativeException: 'NoCredentialException', token: 'SECRET' },
    })
    plugin.getCredential.mockRejectedValue(failure)
    installAndroidPasskeyControl(plugin as unknown as CapacitorPasskeyPlugin)
    await expect(plugin.getCredential({})).rejects.toBe(failure)
    await jest.advanceTimersByTimeAsync(0)
    expect(mockCapture).toHaveBeenCalledWith(
        'passkey_native_diagnostic',
        expect.objectContaining({
            nativeException: 'NoCredentialException',
            outcome: 'error',
            operation: 'get',
            playServicesStatus: 'unknown',
        })
    )
    expect(JSON.stringify(mockCapture.mock.calls)).not.toContain('SECRET')
    expect(JSON.stringify(mockCapture.mock.calls)).not.toContain('challenge')
})

it('bounds diagnostics hangs and tolerates old binaries with missing methods', async () => {
    const { installAndroidPasskeyControl, cancelActiveAndroidPasskeyRequest } =
        await import('../android-passkey-control')
    mockCall.mockImplementation((method: string, _options: unknown, unavailable: () => unknown) =>
        method === 'getDiagnostics' ? new Promise(() => {}) : Promise.resolve(unavailable())
    )
    const plugin = pluginFixture()
    plugin.getCredential.mockResolvedValue('credential')
    installAndroidPasskeyControl(plugin as unknown as CapacitorPasskeyPlugin)
    await expect(plugin.getCredential({})).resolves.toBe('credential')
    expect(mockCapture).not.toHaveBeenCalled()
    await jest.advanceTimersByTimeAsync(1000)
    expect(mockCapture).toHaveBeenCalledTimes(1)
    const rawPending = deferred<unknown>()
    // A separate plugin still shares the controller, as a shim reinstall must.
    const other = pluginFixture()
    other.getCredential.mockReturnValue(rawPending.promise)
    installAndroidPasskeyControl(other as unknown as CapacitorPasskeyPlugin)
    const result = other.getCredential({}).catch((error: Error) => error)
    cancelActiveAndroidPasskeyRequest()
    await expect(result).resolves.toMatchObject({ name: 'CeremonyTimeoutError' })
    // Pre-patch binary: nothing to cancel, so the slot frees after the grace and the next tap runs.
    const next = plugin.getCredential({})
    await jest.advanceTimersByTimeAsync(2000)
    await expect(next).resolves.toBe('credential')
    expect(mockCall.mock.calls.filter(([method]) => method === 'cancelRequest')).toHaveLength(0)
})

it('does not wrap iOS or web methods', async () => {
    mockSupported.mockReturnValue(false)
    const { installAndroidPasskeyControl } = await import('../android-passkey-control')
    const plugin = pluginFixture()
    const original = plugin.getCredential
    installAndroidPasskeyControl(plugin as unknown as CapacitorPasskeyPlugin)
    expect(plugin.getCredential).toBe(original)
    expect(mockCall).not.toHaveBeenCalled()
})

it('fences a late options response after the ceremony deadline before any native invocation', async () => {
    const { installAndroidPasskeyControl } = await import('../android-passkey-control')
    const { beginAndroidPasskeyScope } = await import('../android-passkey-scope')
    const plugin = pluginFixture()
    const rawGet = plugin.getCredential.mockResolvedValue('credential')
    installAndroidPasskeyControl(plugin as unknown as CapacitorPasskeyPlugin)
    const scope = beginAndroidPasskeyScope()!
    const options = deferred<unknown>()
    const operation = options.promise.then(() => plugin.getCredential({})).finally(scope.finish)
    const result = operation.catch((error: Error) => error)
    scope.expire()
    expect(() => beginAndroidPasskeyScope()).toThrow(expect.objectContaining({ name: 'PasskeyRequestSettlingError' }))
    options.resolve({})
    await expect(result).resolves.toMatchObject({ name: 'CeremonyTimeoutError' })
    expect(rawGet).not.toHaveBeenCalled()
    const next = beginAndroidPasskeyScope()!
    await expect(plugin.getCredential({})).resolves.toBe('credential')
    next.finish()
})

it('an older ceremony deadline cannot cancel a newer native request', async () => {
    const { installAndroidPasskeyControl } = await import('../android-passkey-control')
    const { beginAndroidPasskeyScope } = await import('../android-passkey-scope')
    const plugin = pluginFixture()
    const pending = deferred<unknown>()
    plugin.getCredential.mockResolvedValueOnce('first').mockReturnValueOnce(pending.promise)
    installAndroidPasskeyControl(plugin as unknown as CapacitorPasskeyPlugin)
    const first = beginAndroidPasskeyScope()!
    await plugin.getCredential({})
    // Actual guarded signing is rejected while verification is outstanding.
    expect(() => beginAndroidPasskeyScope()).toThrow(expect.objectContaining({ name: 'CeremonyConflictError' }))
    first.finish()
    const next = beginAndroidPasskeyScope()!
    const result = plugin.getCredential({})
    first.expire()
    expect(mockCall.mock.calls.filter(([method]) => method === 'cancelRequest')).toHaveLength(0)
    pending.resolve('second')
    await expect(result).resolves.toBe('second')
    next.finish()
})

describe('binary contract', () => {
    it.each([
        [{ pluginVersion: '8.2.2-peanut.2' }, 'release'],
        [{ pluginVersion: '8.2.2-peanut.10' }, 'release'],
        [{ pluginVersion: '8.2.2-peanut.1' }, 'confirm'],
        [{ pluginVersion: '8.0.0' }, 'none'],
        [{ pluginVersion: 7 }, 'unknown'],
        [{}, 'unknown'],
    ])('%j -> %s', async (facts, expected) => {
        const { androidPasskeyContract } = await import('../android-passkey-control')
        expect(androidPasskeyContract(facts)).toBe(expected)
    })

    const current = (androidSdk: number, cancel: () => Promise<unknown>) =>
        mockCall.mockImplementation((method: string) =>
            method === 'cancelRequest' ? cancel() : Promise.resolve({ androidSdk, pluginVersion: '8.2.2-peanut.1' })
        )

    it('current store binary on Android 14+: native still blocking -> one bounded retry, honest error, next tap probes again', async () => {
        current(36, () => new Promise(() => {}))
        const { installAndroidPasskeyControl, cancelActiveAndroidPasskeyRequest } =
            await import('../android-passkey-control')
        const plugin = pluginFixture()
        const old = deferred<unknown>()
        const rawGet = plugin.getCredential.mockReturnValueOnce(old.promise).mockRejectedValue(nativePending())
        installAndroidPasskeyControl(plugin as unknown as CapacitorPasskeyPlugin)
        await jest.advanceTimersByTimeAsync(0)
        const first = plugin.getCredential({}).catch((error: Error) => error)
        cancelActiveAndroidPasskeyRequest()
        await expect(first).resolves.toMatchObject({ name: 'CeremonyTimeoutError' })
        expect(mockCall).toHaveBeenCalledWith('cancelRequest', expect.anything(), expect.any(Function))
        await jest.advanceTimersByTimeAsync(2000)
        const second = plugin.getCredential({}).catch((error: Error) => error)
        await jest.advanceTimersByTimeAsync(2000)
        await expect(second).resolves.toMatchObject({ name: 'PasskeyCleanupPendingError' })
        expect(rawGet).toHaveBeenCalledTimes(2)
        expect(mockCapture).toHaveBeenCalledWith(
            'passkey_native_lifecycle',
            expect.objectContaining({ phase: 'native_pending', recovery: 'still_pending', contract: 'confirm' })
        )
        old.resolve('late')
        await jest.advanceTimersByTimeAsync(0)
        rawGet.mockResolvedValueOnce('credential')
        await expect(plugin.getCredential({})).resolves.toBe('credential')
    })

    it('current store binary on Android 13 and older: no cancel is sent, since Play Services would then never call back', async () => {
        current(33, async () => ({ cancelled: false }))
        const { installAndroidPasskeyControl, cancelActiveAndroidPasskeyRequest } =
            await import('../android-passkey-control')
        const plugin = pluginFixture()
        plugin.getCredential.mockReturnValueOnce(new Promise(() => {})).mockResolvedValue('credential')
        installAndroidPasskeyControl(plugin as unknown as CapacitorPasskeyPlugin)
        await jest.advanceTimersByTimeAsync(0)
        const first = plugin.getCredential({}).catch((error: Error) => error)
        cancelActiveAndroidPasskeyRequest()
        await expect(first).resolves.toMatchObject({ name: 'CeremonyTimeoutError' })
        await jest.advanceTimersByTimeAsync(2000)
        expect(mockCall.mock.calls.filter(([method]) => method === 'cancelRequest')).toHaveLength(0)
        await expect(plugin.getCredential({})).resolves.toBe('credential')
    })

    it('an unnamed provider failure right after an unsettled release is a retryable settling error, once', async () => {
        const { installAndroidPasskeyControl, cancelActiveAndroidPasskeyRequest } =
            await import('../android-passkey-control')
        const plugin = pluginFixture()
        const unnamed = Object.assign(new Error('Native passkey request failed.'), {
            code: 'UnknownError',
            data: { name: 'UnknownError' },
        })
        plugin.getCredential.mockReturnValueOnce(new Promise(() => {})).mockRejectedValue(unnamed)
        installAndroidPasskeyControl(plugin as unknown as CapacitorPasskeyPlugin)
        await jest.advanceTimersByTimeAsync(0)
        void plugin.getCredential({}).catch(() => {})
        cancelActiveAndroidPasskeyRequest()
        await jest.advanceTimersByTimeAsync(0)
        await expect(plugin.getCredential({})).rejects.toMatchObject({
            name: 'PasskeyRequestSettlingError',
            cause: unnamed,
        })
        await expect(plugin.getCredential({})).rejects.toBe(unnamed)
    })

    it('a named provider outcome right after a release is passed through unchanged', async () => {
        const { installAndroidPasskeyControl, cancelActiveAndroidPasskeyRequest } =
            await import('../android-passkey-control')
        const plugin = pluginFixture()
        const cancelled = Object.assign(new Error('User cancelled the selector'), { code: 'NotAllowedError' })
        plugin.getCredential.mockReturnValueOnce(new Promise(() => {})).mockRejectedValue(cancelled)
        installAndroidPasskeyControl(plugin as unknown as CapacitorPasskeyPlugin)
        await jest.advanceTimersByTimeAsync(0)
        void plugin.getCredential({}).catch(() => {})
        cancelActiveAndroidPasskeyRequest()
        await jest.advanceTimersByTimeAsync(0)
        await expect(plugin.getCredential({})).rejects.toBe(cancelled)
    })
})
