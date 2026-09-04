// nativeCapability is the single door to app-local Capacitor plugins, so its
// job is the failure paths: a plugin the running binary predates, a platform
// with no native half, and the registerPlugin proxy's thenable trap.
import { nativeCapability } from '../native-capability'
import { isAndroidNative, isIOSNative } from '../capacitor'
import { createPluginProxy, expectToSettle } from '../__mocks__/capacitor-plugin-proxy'

const pluginImplementation: Record<string, unknown> = {}

jest.mock('@capacitor/core', () => ({
    // The real registerPlugin returns a Proxy, not a plain object. Mocking it
    // as a plain object is what hides the thenable trap, so the house mock is
    // used here too.
    registerPlugin: jest.fn(() =>
        jest.requireActual('../__mocks__/capacitor-plugin-proxy').createPluginProxy(pluginImplementation, 'TestPlugin')
    ),
}))

jest.mock('../capacitor', () => ({
    isIOSNative: jest.fn(() => false),
    isAndroidNative: jest.fn(() => false),
}))

const mockIsIOSNative = isIOSNative as jest.MockedFunction<typeof isIOSNative>
const mockIsAndroidNative = isAndroidNative as jest.MockedFunction<typeof isAndroidNative>

interface TestPlugin {
    doThing(options?: undefined): Promise<{ value: string }>
}

describe('nativeCapability', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        for (const key of Object.keys(pluginImplementation)) delete pluginImplementation[key]
        mockIsIOSNative.mockReturnValue(false)
        mockIsAndroidNative.mockReturnValue(false)
    })

    it('returns the native answer on a supported platform', async () => {
        mockIsIOSNative.mockReturnValue(true)
        pluginImplementation.doThing = jest.fn(async () => ({ value: 'native' }))

        const capability = nativeCapability<TestPlugin>('TestPlugin', { platforms: ['ios'] })

        await expect(capability.call('doThing', undefined, () => ({ value: 'fallback' }))).resolves.toEqual({
            value: 'native',
        })
    })

    it('falls back without touching the plugin on an unsupported platform', async () => {
        mockIsAndroidNative.mockReturnValue(true)
        const doThing = jest.fn()
        pluginImplementation.doThing = doThing

        const capability = nativeCapability<TestPlugin>('TestPlugin', { platforms: ['ios'] })

        await expect(capability.call('doThing', undefined, () => ({ value: 'fallback' }))).resolves.toEqual({
            value: 'fallback',
        })
        // Not merely "answered fallback": on web the proxy exists and invoking
        // it rejects, so the gate has to stop the call, not catch it.
        expect(doThing).not.toHaveBeenCalled()
    })

    it('falls back when the running binary predates the plugin', async () => {
        mockIsIOSNative.mockReturnValue(true)
        // The method is simply absent — exactly an older binary running OTA'd
        // JS. The proxy answers with an Unimplemented rejection, not undefined.

        const capability = nativeCapability<TestPlugin>('TestPlugin', { platforms: ['ios'] })

        await expect(capability.call('doThing', undefined, () => ({ value: 'fallback' }))).resolves.toEqual({
            value: 'fallback',
        })
    })

    it('hands the rejection to the fallback, for callers that report it', async () => {
        mockIsIOSNative.mockReturnValue(true)
        pluginImplementation.doThing = jest.fn(async () => {
            throw new Error('user cancelled')
        })

        const capability = nativeCapability<TestPlugin>('TestPlugin', { platforms: ['ios'] })
        const result = await capability.call('doThing', undefined, (error) => ({
            value: error instanceof Error ? error.message : 'unknown',
        }))

        expect(result).toEqual({ value: 'user cancelled' })
    })

    it('settles rather than hanging, even though the plugin is a proxy', async () => {
        mockIsIOSNative.mockReturnValue(true)
        pluginImplementation.doThing = jest.fn(async () => ({ value: 'native' }))

        const capability = nativeCapability<TestPlugin>('TestPlugin', { platforms: ['ios'] })

        // The trap this closes: resolving a promise WITH the plugin makes the
        // runtime probe proxy.then, which dispatches a native call that never
        // invokes either callback — the promise stays pending forever.
        await expect(
            expectToSettle(capability.call('doThing', undefined, () => ({ value: 'fallback' })))
        ).resolves.toEqual({ value: 'native' })
    })

    it('gives callers no way to get the proxy back out', () => {
        const capability = nativeCapability<TestPlugin>('TestPlugin', { platforms: ['ios'] })

        // The reason `call` takes a method NAME. With a callback signature,
        // `call(async (plugin) => plugin, fallback)` type-checks and then hangs
        // forever: the async function assimilates the proxy's .then while
        // resolving, so it never reaches the catch or the fallback. There is no
        // runtime guard for it — the hang happens before any code of ours runs
        // again — so the invariant has to hold at the type level, and typecheck
        // is a CI job. If this stops erroring, the hole is back.
        const callback = async (plugin: TestPlugin) => plugin
        const fallback = () => undefined

        // Declared and never invoked. TypeScript still checks the body, which
        // is the whole assertion — running it would crash: the two-argument
        // call leaves onUnavailable undefined, and the point is precisely that
        // this does not compile.
        //
        // Each directive sits directly above its CALL because it binds to the
        // next LINE, and prettier wraps a long argument list — which parks the
        // error below the comment and reports the directive itself as unused.
        const rejectedByTheCompiler = () => {
            // @ts-expect-error a callback is not a method name
            void capability.call(callback, fallback)
            // @ts-expect-error 'notAMethod' is not a method on TestPlugin
            void capability.call('notAMethod', undefined, fallback)
        }

        expect(typeof rejectedByTheCompiler).toBe('function')
    })

    it('reports platform support from the declared platforms', () => {
        const iosOnly = nativeCapability<TestPlugin>('TestPlugin', { platforms: ['ios'] })
        const both = nativeCapability<TestPlugin>('TestPlugin', { platforms: ['ios', 'android'] })

        expect(iosOnly.isSupportedPlatform()).toBe(false)

        mockIsAndroidNative.mockReturnValue(true)
        expect(iosOnly.isSupportedPlatform()).toBe(false)
        expect(both.isSupportedPlatform()).toBe(true)

        mockIsAndroidNative.mockReturnValue(false)
        mockIsIOSNative.mockReturnValue(true)
        expect(iosOnly.isSupportedPlatform()).toBe(true)
    })

    it('keeps the house proxy semantics the mock exists to enforce', async () => {
        // Guards the guard: if createPluginProxy ever stopped rejecting for
        // absent methods, every "older binary" test above would pass vacuously.
        const proxy = createPluginProxy<Record<string, unknown>>({}, 'TestPlugin')

        await expect((proxy as unknown as TestPlugin).doThing()).rejects.toThrow('is not implemented')
    })
})
