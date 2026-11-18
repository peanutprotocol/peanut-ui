import { sanitizePasskeyDiagnostics } from './android-passkey-diagnostics'
import { isAndroidNativeBridge } from './capacitor'
import { nativeErrorCode } from './native-passkey-errors'

type DeviceFacts = { device_model?: string; android_version?: string; play_services_version?: string }
type PluginRejection = { code?: unknown; data?: { name?: unknown; nativeException?: unknown }; cause?: unknown }

let deviceFacts: DeviceFacts = {}
let loading: Promise<void> | undefined

const known = (value: unknown) => (typeof value === 'string' && value !== 'unknown' ? value : undefined)

/**
 * Reads the Android device facts once per session, so failure events can attach them synchronously.
 * Call it when a passkey flow starts: the native read is fast, the ceremony is not.
 * Binaries without getDiagnostics reject; their events then carry no device facts.
 */
export function loadPasskeyDeviceFacts(): Promise<void> {
    if (!loading && isAndroidNativeBridge()) {
        loading = import('@capgo/capacitor-passkey')
            .then(({ CapacitorPasskey }) => CapacitorPasskey.getDiagnostics())
            .then((raw) => {
                // The sanitizer keeps model and versions; manufacturer and app facts are not needed here.
                const facts = sanitizePasskeyDiagnostics(raw)
                deviceFacts = {
                    device_model: known(facts.model),
                    android_version: known(facts.osVersion),
                    play_services_version: known(facts.playServicesVersion),
                }
            })
            .catch(() => {})
    }
    return loading ?? Promise.resolve()
}

/** Capacitor rejects with a plain Error; the DOM name the plugin chose is in `code` or `data.name`. */
function errorName(error: Error): string | undefined {
    const rejection = error as Error & PluginRejection
    const pluginName = [rejection.code, rejection.data?.name].find(
        (name): name is string => typeof name === 'string' && name.endsWith('Error')
    )
    const name = error.name === 'Error' && pluginName ? pluginName : error.name
    return /^[A-Za-z]{1,80}$/.test(name) ? name : undefined
}

/**
 * The bounded, PII-free facts every passkey failure event carries: error and native names, and the
 * device model and versions. Each is undefined when unknown. Raw messages never leave this function.
 */
export function passkeyFailureFields(error: unknown): Record<string, string | number | undefined> {
    const cause = error instanceof Error ? (error as PluginRejection).cause : undefined
    const layers = [error, cause]
    const nativeException = layers
        .map((layer) => (layer as PluginRejection | undefined)?.data?.nativeException)
        .find((value) => value !== undefined)
    return {
        error_name: error instanceof Error ? errorName(error) : undefined,
        native_error_code: layers.map(nativeErrorCode).find(Boolean),
        native_exception: sanitizePasskeyDiagnostics({ nativeException }).nativeException as string | undefined,
        ...deviceFacts,
    }
}
