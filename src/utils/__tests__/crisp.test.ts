/**
 * ensureNativeCrispConfigured — the Capacitor plugin-proxy thenable trap.
 *
 * Every other Crisp test mocks @capgo/capacitor-crisp with a plain object, and a
 * plain object has no `.then`. That is precisely why this bug shipped twice (once
 * as getPreferences() in auth-token, once here): the real plugin is a Proxy from
 * registerPlugin() that answers ANY property with a native-method wrapper —
 * including `then`. Settling a promise with it makes the runtime treat it as a
 * thenable and call `proxy.then(resolve, reject)`; the wrapper dispatches a
 * "CapacitorCrisp.then()" native call and never invokes either callback, so the
 * promise stays pending forever. On native that left support opening to a blank
 * panel with no error, since the .catch never ran either.
 *
 * So this file mocks the plugin the way Capacitor actually builds it.
 */

const configure = jest.fn().mockResolvedValue(undefined)
const openMessenger = jest.fn().mockResolvedValue(undefined)
const reset = jest.fn().mockResolvedValue(undefined)

const realMethods: Record<string, jest.Mock> = { configure, openMessenger, reset }

/** Mirrors @capacitor/core registerPlugin(): unknown props become method wrappers
 *  that reject with Unimplemented rather than returning undefined. */
const pluginProxy = new Proxy({} as Record<string, unknown>, {
    get(_target, prop: string) {
        if (prop === '$$typeof') return undefined
        if (prop in realMethods) return realMethods[prop]
        return () => Promise.reject(new Error(`"CapacitorCrisp.${prop}()" is not implemented on ios`))
    },
})

jest.mock('@capgo/capacitor-crisp', () => ({ CapacitorCrisp: pluginProxy }))
jest.mock('@/utils/capacitor', () => ({ isCapacitor: () => true }))

const withTimeout = <T>(promise: Promise<T>, ms = 200): Promise<T> =>
    Promise.race([
        promise,
        new Promise<never>((_, rejectTimeout) =>
            setTimeout(() => rejectTimeout(new Error('promise never settled')), ms)
        ),
    ])

describe('ensureNativeCrispConfigured', () => {
    beforeEach(() => {
        jest.resetModules()
        jest.clearAllMocks()
    })

    it('settles, and hands back a usable plugin, against a real-shaped plugin proxy', async () => {
        const { ensureNativeCrispConfigured } = await import('@/utils/crisp')

        const { CapacitorCrisp } = await withTimeout(ensureNativeCrispConfigured())

        expect(configure).toHaveBeenCalledWith({ websiteID: expect.any(String) })
        await CapacitorCrisp.openMessenger()
        expect(openMessenger).toHaveBeenCalled()
    })

    it('configures once across repeated support opens', async () => {
        const { ensureNativeCrispConfigured } = await import('@/utils/crisp')

        await withTimeout(ensureNativeCrispConfigured())
        await withTimeout(ensureNativeCrispConfigured())

        expect(configure).toHaveBeenCalledTimes(1)
    })

    it('retries configuration on the next open after a failure', async () => {
        configure.mockRejectedValueOnce(new Error('sdk boom'))
        const { ensureNativeCrispConfigured } = await import('@/utils/crisp')

        await expect(withTimeout(ensureNativeCrispConfigured())).rejects.toThrow('sdk boom')
        await expect(withTimeout(ensureNativeCrispConfigured())).resolves.toBeDefined()

        expect(configure).toHaveBeenCalledTimes(2)
    })

    it('resets the native session on logout once support has been opened', async () => {
        const { ensureNativeCrispConfigured, resetCrispProxySessions } = await import('@/utils/crisp')

        await withTimeout(ensureNativeCrispConfigured())
        resetCrispProxySessions()
        await withTimeout(Promise.resolve())

        expect(reset).toHaveBeenCalled()
    })
})
