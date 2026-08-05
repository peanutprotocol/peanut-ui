// Haptic feedback. On native (Capacitor) this drives the real Taptic/vibration
// engine via @capacitor/haptics; on web it falls back to the Vibration API.
// Fire-and-forget — failures are swallowed so haptics never break a flow.
//
// Never call navigator.vibrate() directly at a call site. iOS has never
// implemented the Vibration API in any version, Safari or WKWebView, so a
// web-only haptic is permanently dead there and fails silently.

import { isCapacitor } from '@/utils/capacitor'

type NotificationKind = 'success' | 'warning' | 'error'

/*
 * use-haptic's 5ms default is below the perceptible threshold: a vibration
 * motor cannot spin up and settle in 5ms, so the call succeeds, reports no
 * error, and nothing is felt. These are the shortest durations that actually
 * register on real hardware.
 */
export const WEB_TAP_MS = 15

const WEB_NOTIFY_PATTERN: Record<NotificationKind, number[]> = {
    success: [15, 60, 25],
    warning: [25, 60, 25],
    error: [35, 60, 35, 60, 35],
}

function webVibrate(pattern: number | number[]): void {
    if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return
    try {
        navigator.vibrate(pattern)
    } catch {
        // haptics are non-essential — ignore
    }
}

/*
 * The dynamic import is deliberately not memoized in a module-level promise.
 * The ES module registry already caches it, and a memoized promise that
 * rejects once stays rejected for the life of the document — which on native
 * is the life of the app, since the WebView never reloads.
 */
function withNativeHaptics(use: (haptics: typeof import('@capacitor/haptics')) => Promise<void>): void {
    import('@capacitor/haptics').then(use).catch(() => {
        // haptics are non-essential — ignore
    })
}

/** Success/warning/error confirmation buzz — e.g. after a transfer completes. */
export function notifyHaptic(kind: NotificationKind = 'success'): void {
    if (!isCapacitor()) {
        webVibrate(WEB_NOTIFY_PATTERN[kind])
        return
    }
    withNativeHaptics(({ Haptics, NotificationType }) => {
        const type =
            kind === 'success'
                ? NotificationType.Success
                : kind === 'warning'
                  ? NotificationType.Warning
                  : NotificationType.Error
        return Haptics.notification({ type })
    })
}

/** Light tap for incidental UI feedback (button press, selection). */
export function impactHaptic(): void {
    if (!isCapacitor()) {
        webVibrate(WEB_TAP_MS)
        return
    }
    withNativeHaptics(({ Haptics, ImpactStyle }) => Haptics.impact({ style: ImpactStyle.Light }))
}

/** Heavier tap for a deliberate, consequential action. */
export function heavyImpactHaptic(): void {
    if (!isCapacitor()) {
        webVibrate(WEB_TAP_MS * 2)
        return
    }
    withNativeHaptics(({ Haptics, ImpactStyle }) => Haptics.impact({ style: ImpactStyle.Heavy }))
}

/** Arbitrary buzz where the pattern itself carries meaning (escalating shake feedback). */
export function vibrateHaptic(pattern: number | number[]): void {
    if (!isCapacitor()) {
        webVibrate(pattern)
        return
    }
    // The native plugin takes a single duration, not a web-style on/off pattern —
    // collapse a pattern to its total buzz time.
    const duration = Array.isArray(pattern)
        ? pattern.filter((_, index) => index % 2 === 0).reduce((total, ms) => total + ms, 0)
        : pattern
    if (duration <= 0) return
    withNativeHaptics(({ Haptics }) => Haptics.vibrate({ duration }))
}

/** Stop an in-flight vibration (web only — the native plugin has no cancel). */
export function cancelHaptic(): void {
    if (isCapacitor()) return
    webVibrate(0)
}
