import { isAndroidNativeBridge } from '@/utils/capacitor'

/**
 * Settle the OS camera permission before a camera surface opens.
 *
 * Android deliberately uses the WebView's getUserMedia permission path instead
 * of the Capacitor Camera plugin. Capacitor's BridgeWebChromeClient maps that
 * request directly to android.permission.CAMERA. More importantly, the minified
 * Android 1.5.0 shell crashes natively inside CameraPlugin.getPermissionStates
 * before a rejected promise can reach JavaScript (PEANUT-UI-T30). Returning true
 * here does not grant anything: it lets the real camera request prompt, deny, or
 * resolve, and the scanner's existing error handling owns that outcome.
 *
 * iOS keeps the explicit plugin preflight. Best effort: on any plugin error we
 * return true and let the caller's own permission flow run.
 */
export async function ensureNativeCameraPermission(): Promise<boolean> {
    if (isAndroidNativeBridge()) return true

    try {
        const { Camera } = await import('@capacitor/camera')
        const status = await Camera.checkPermissions()
        if (status.camera === 'granted' || status.camera === 'limited') return true
        const requested = await Camera.requestPermissions({ permissions: ['camera'] })
        return requested.camera === 'granted' || requested.camera === 'limited'
    } catch (err) {
        console.warn('Native camera permission check failed:', err)
        return true
    }
}
