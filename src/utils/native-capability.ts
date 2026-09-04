import { registerPlugin } from '@capacitor/core'
import { isAndroidNative, isIOSNative } from './capacitor'

/**
 * The one place app-local Capacitor plugins are reached, because every call to
 * one has to survive the same thing: **the JS half ships over the air onto
 * binaries built months earlier.** A plugin the current tree takes for granted
 * simply is not there on an older shell, and Capacitor's answer to a missing
 * native method is a rejected promise, not a compile error — so a forgotten
 * try/catch is a crash on a user's device that no test and no type sees.
 *
 * Three separate hazards get closed here instead of at each call site:
 *
 * 1. **Missing plugin.** Older binary, or a platform with no implementation:
 *    the call rejects, and `call()` answers with the caller's fallback.
 * 2. **Wrong platform.** `registerPlugin` happily hands back a proxy on web,
 *    where invoking it rejects. The platform gate means no call is attempted.
 * 3. **The thenable trap.** The proxy answers ANY property with a native-method
 *    wrapper, `.then` included, so resolving a promise WITH a plugin leaves it
 *    pending forever (shipped twice — getPreferences in 1.0.44, the Crisp
 *    helper in 1.0.45–1.0.47). Here the proxy never escapes the closure it is
 *    handed to, so it cannot be returned across an await by construction.
 *
 * Version-gated capabilities — where the plugin EXISTS but an older native half
 * behaves differently — are a different problem and stay bespoke; see
 * `canRestartInPlace()` in capgo-updater.ts, which reads the native plugin's own
 * version rather than trusting package.json.
 */

type NativePlatform = 'ios' | 'android'

export interface NativeCapability<T> {
    /**
     * Runs one native call, or answers with `onUnavailable` when it cannot.
     *
     * The fallback is a function, never a bare value, so every call site has to
     * say what "this device can't do it" means — the omission that turns a
     * missing plugin into a crash. It receives the rejection for the cases that
     * want to report it.
     */
    call<R>(invoke: (plugin: T) => Promise<R>, onUnavailable: (error: unknown) => R): Promise<R>
    /** Whether a native implementation could exist here at all. No native call. */
    isSupportedPlatform(): boolean
}

/**
 * Declares an app-local plugin and the platforms whose binaries implement it.
 *
 * `platforms` is about where the native code was WRITTEN, not where it happens
 * to be installed: an iOS-only plugin declares `['ios']`, and an older iOS
 * binary that predates it still falls back through `call()`.
 */
export function nativeCapability<T extends object>(
    name: string,
    { platforms }: { platforms: NativePlatform[] }
): NativeCapability<T> {
    const plugin = registerPlugin<T>(name)

    const isSupportedPlatform = () =>
        (platforms.includes('ios') && isIOSNative()) || (platforms.includes('android') && isAndroidNative())

    return {
        isSupportedPlatform,
        async call(invoke, onUnavailable) {
            if (!isSupportedPlatform()) return onUnavailable(new Error(`${name} is not available on this platform`))
            try {
                return await invoke(plugin)
            } catch (error) {
                // Every rejection is the same answer to the caller: a missing
                // plugin, an unimplemented method on this platform, and a
                // genuine native error are indistinguishable here and all mean
                // "you don't get this". Callers that need the detail read it
                // off the error they are handed.
                return onUnavailable(error)
            }
        },
    }
}
