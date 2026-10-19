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
            ? { cancelled: false }
            : {
                  androidSdk: 36,
                  manufacturer: 'vivo',
                  model: 'V2227A',
                  playServicesStatus: 'unknown',
                  challenge: 'secret',
              }
    )
})
afterEach(() => {
    jest.clearAllTimers()
    jest.useRealTimers()
})

it('shares native ownership across get/create and forwards a bounded request ID', async () => {
    const { installAndroidPasskeyControl, cancelActiveAndroidPasskeyRequest } =
        await import('../android-passkey-control')
    const pending = deferred<unknown>()
    const plugin = pluginFixture()
    const nativeGet = plugin.getCredential.mockReturnValue(pending.promise)
    const nativeCreate = plugin.createCredential.mockResolvedValue('new')
    installAndroidPasskeyControl(plugin as unknown as CapacitorPasskeyPlugin)
    installAndroidPasskeyControl(plugin as unknown as CapacitorPasskeyPlugin)
    const original = plugin.getCredential({ publicKey: { challenge: 'private' } }).catch((error: Error) => error)
    expect(nativeGet).toHaveBeenCalledTimes(1)
    const id = nativeGet.mock.calls[0][0].requestId
    expect(id).toMatch(/^[A-Za-z0-9_-]{1,64}$/)
    await expect(plugin.createCredential({})).rejects.toMatchObject({ name: 'CeremonyConflictError' })
    expect(nativeCreate).not.toHaveBeenCalled()
    cancelActiveAndroidPasskeyRequest()
    await expect(original).resolves.toMatchObject({ name: 'CeremonyTimeoutError' })
    expect(mockCall).toHaveBeenCalledWith('cancelRequest', { requestId: id }, expect.any(Function))
    await jest.advanceTimersByTimeAsync(2000)
    await expect(plugin.createCredential({})).rejects.toMatchObject({ name: 'PasskeyCleanupPendingError' })
    expect(nativeCreate).not.toHaveBeenCalled()
    pending.resolve('late credential')
    await jest.advanceTimersByTimeAsync(0)
    await expect(plugin.createCredential({})).resolves.toBe('new')
    expect(nativeCreate).toHaveBeenCalledTimes(1)
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
    await expect(plugin.getCredential({})).rejects.toMatchObject({ name: 'PasskeyCleanupPendingError' })
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
    expect(() => beginAndroidPasskeyScope()).toThrow(expect.objectContaining({ name: 'PasskeyCleanupPendingError' }))
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
