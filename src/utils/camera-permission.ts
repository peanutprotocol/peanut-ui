/**
 * On native, settle the OS camera permission before a camera surface opens
 * (getUserMedia in the QR scanner, the Crisp SDK's "Take a photo"). The app
 * declares android.permission.CAMERA, which obligates a runtime grant before
 * ANY camera intent — an SDK that assumes an undeclared permission (Crisp)
 * hits a SecurityException instead of prompting. Best effort: on any plugin
 * error we return true and let the caller's own permission flow run.
 */
export async function ensureNativeCameraPermission(): Promise<boolean> {
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
