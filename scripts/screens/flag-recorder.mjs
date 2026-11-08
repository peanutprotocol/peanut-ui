/** Patched into the flag readers by prepare.mjs; its presence is how a capture knows flags can be set. */
export const FLAG_RECORDER_MARKER = '/* screen-capture-flags-v1 */'

const HOOK = `(globalThis as unknown as { __screenCaptureFlag?: (key: string, value: unknown) => unknown }).__screenCaptureFlag`

/**
 * Every PostHog read the app makes goes through one of these two functions. Each is renamed and wrapped so
 * a capture can record the value the screen read and substitute another; outside capture the hook is absent.
 */
export const FLAG_READERS = [
    {
        path: 'src/utils/featureFlag.utils.ts',
        anchor: 'export function isFeatureFlagEnabled(flagKey: FeatureFlagKey, options: FeatureFlagOptions = {}): boolean {',
        live: 'function isFeatureFlagEnabledLive(flagKey: FeatureFlagKey, options: FeatureFlagOptions = {}): boolean {',
        wrapper: `
${FLAG_RECORDER_MARKER}
export function isFeatureFlagEnabled(flagKey: FeatureFlagKey, options: FeatureFlagOptions = {}): boolean {
    const value = isFeatureFlagEnabledLive(flagKey, options)
    const capture = ${HOOK}
    return capture ? (capture(flagKey, value) as boolean) : value
}
`,
    },
    {
        path: 'src/features/setup/notificationsExperiment.ts',
        anchor: 'export function readNotificationsVariant(): NotificationsVariant {',
        live: 'function readNotificationsVariantLive(): NotificationsVariant {',
        wrapper: `
${FLAG_RECORDER_MARKER}
export function readNotificationsVariant(): NotificationsVariant {
    const value = readNotificationsVariantLive()
    const capture = ${HOOK}
    return capture ? (capture(NOTIFICATIONS_EXPERIMENT_FLAG, value) as NotificationsVariant) : value
}
`,
    },
]

/** A revision without the anchor keeps its source; its screens cannot take flag overrides. */
export function patchFlagReader(reader, source) {
    if (source.includes(FLAG_RECORDER_MARKER) || !source.includes(reader.anchor)) return source
    return source.replace(reader.anchor, reader.live) + reader.wrapper
}

/** Browser init script: records each flag a screen reads, answering with the screen's override when it has one. */
export function installFlagRecorder(overrides) {
    const read = {}
    Object.defineProperty(window, '__screenCaptureFlag', {
        value: (key, value) => {
            if (!(key in read)) read[key] = value
            return Object.prototype.hasOwnProperty.call(overrides, key) ? overrides[key] : value
        },
        configurable: true,
    })
    Object.defineProperty(window, '__screenCaptureFlagReads', { value: read, configurable: true })
}
