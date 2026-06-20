// Native haptic feedback via @capacitor/haptics.
//
// On native (Capacitor) this uses the real Taptic/vibration engine, which feels
// markedly better than navigator.vibrate in a webview. On web it's a no-op —
// components already use the `use-haptic` hook there. Fire-and-forget; failures
// are swallowed so haptics never break a flow.

import { isCapacitor } from '@/utils/capacitor'

type NotificationKind = 'success' | 'warning' | 'error'

/** Success/warning/error confirmation buzz — e.g. after a transfer completes. */
export function notifyHaptic(kind: NotificationKind = 'success'): void {
    if (!isCapacitor()) return
    import('@capacitor/haptics')
        .then(({ Haptics, NotificationType }) => {
            const type =
                kind === 'success'
                    ? NotificationType.Success
                    : kind === 'warning'
                      ? NotificationType.Warning
                      : NotificationType.Error
            return Haptics.notification({ type })
        })
        .catch(() => {
            // haptics are non-essential — ignore
        })
}

/** Light tap for incidental UI feedback (button press, selection). */
export function impactHaptic(): void {
    if (!isCapacitor()) return
    import('@capacitor/haptics')
        .then(({ Haptics, ImpactStyle }) => Haptics.impact({ style: ImpactStyle.Light }))
        .catch(() => {
            // non-essential
        })
}
