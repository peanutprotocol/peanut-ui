const MOTION_GRANT_KEY = 'peanut.shakeMotionGranted'

export type MotionPermissionApi = { requestPermission: () => Promise<'granted' | 'denied' | 'default'> }

export function rememberMotionGrant(): void {
    try {
        window.localStorage.setItem(MOTION_GRANT_KEY, '1')
    } catch {}
}

export function forgetMotionGrant(): void {
    try {
        window.localStorage.removeItem(MOTION_GRANT_KEY)
    } catch {}
}

export function hasRememberedMotionGrant(): boolean {
    try {
        return window.localStorage.getItem(MOTION_GRANT_KEY) === '1'
    } catch {
        return false
    }
}

export function motionNeedsPermission(): boolean {
    return (
        typeof window !== 'undefined' &&
        typeof (window.DeviceMotionEvent as unknown as MotionPermissionApi | undefined)?.requestPermission ===
            'function'
    )
}
