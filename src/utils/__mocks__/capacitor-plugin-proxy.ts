/**
 * A mock shaped like a real Capacitor plugin, for tests that touch one.
 *
 * Mocking a plugin as a plain object — `{ configure: jest.fn(), … }` — is the
 * default instinct and it hides an entire bug class. @capacitor/core's
 * registerPlugin() returns a Proxy whose get handler answers ANY property with
 * a native-method wrapper, `then` included. So settling a promise with a plugin
 * makes the runtime treat it as a thenable and call proxy.then(resolve, reject);
 * the wrapper dispatches a native call and never invokes either callback, and
 * the promise stays pending forever. A plain object has no .then, so no probe
 * happens and the test passes against code that is broken on every device.
 *
 * That exact defect shipped twice — getPreferences() in 1.0.44 and the Crisp
 * helper in 1.0.45–1.0.47 — with a green suite both times. Use this instead.
 */

type PluginMethods = Record<string, unknown>

/**
 * Wraps an implementation in a proxy with registerPlugin()'s lookup semantics:
 * implemented methods pass through, anything else (`then`, `toJSON`, a typo, a
 * method missing on this platform) becomes a wrapper that rejects with
 * Unimplemented rather than returning undefined.
 */
export function createPluginProxy<T extends PluginMethods>(implementation: T, pluginName = 'MockPlugin'): T {
    return new Proxy(implementation, {
        get(target, property: string) {
            // Mirrors the real proxy's React interop escape hatch.
            if (property === '$$typeof') return undefined
            if (property in target) return target[property]
            return () => Promise.reject(new Error(`"${pluginName}.${String(property)}()" is not implemented on ios`))
        },
    }) as T
}

/**
 * Rejects if `promise` has not settled within `ms`.
 *
 * The thenable trap does not produce a rejection — it produces a promise that
 * never settles at all, so `await`ing it in a test hangs until Jest's timeout
 * and reports as a slow test rather than a broken one. Race it instead.
 */
export function expectToSettle<T>(promise: Promise<T>, ms = 200): Promise<T> {
    return Promise.race([
        promise,
        new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('promise never settled — likely a plugin-proxy .then probe')), ms)
        ),
    ])
}
