/**
 * Utility functions for checking camera and microphone availability
 * before initiating KYC flows that require media permissions
 */

export interface MediaCheckResult {
    supported: boolean
    hasCamera: boolean
    hasMicrophone: boolean
    message?: string
    severity: 'error' | 'warning' | 'success'
}

/**
 * Checks if camera and microphone are available on the device
 * This does NOT request permissions, only checks availability
 */
export async function checkMediaAvailability(): Promise<MediaCheckResult> {
    try {
        // Check if getUserMedia API is available
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            return {
                supported: false,
                hasCamera: false,
                hasMicrophone: false,
                message: 'Your browser does not support camera or microphone access.',
                severity: 'error',
            }
        }

        // Try to enumerate devices (doesn't require permission)
        const devices = await navigator.mediaDevices.enumerateDevices()
        const hasCamera = devices.some((device) => device.kind === 'videoinput')
        const hasMicrophone = devices.some((device) => device.kind === 'audioinput')

        // Both camera and microphone required for KYC
        if (!hasCamera && !hasMicrophone) {
            return {
                supported: false,
                hasCamera: false,
                hasMicrophone: false,
                message: 'No camera or microphone detected on your device.',
                severity: 'error',
            }
        }

        if (!hasCamera) {
            return {
                supported: false,
                hasCamera: false,
                hasMicrophone: true,
                message: 'No camera detected. KYC verification requires a camera.',
                severity: 'error',
            }
        }

        if (!hasMicrophone) {
            return {
                supported: true,
                hasCamera: true,
                hasMicrophone: false,
                message: 'No microphone detected. Some verification steps may require a microphone.',
                severity: 'warning',
            }
        }

        return {
            supported: true,
            hasCamera: true,
            hasMicrophone: true,
            severity: 'success',
        }
    } catch (error) {
        console.error('Error checking media availability:', error)
        return {
            supported: false,
            hasCamera: false,
            hasMicrophone: false,
            message: 'Unable to check camera and microphone availability.',
            severity: 'warning',
        }
    }
}

/**
 * Checks if running in an environment where iframe camera/mic access is restricted
 * (e.g., iOS in-app browsers, some WebViews)
 */
export function isRestrictedEnvironment(): boolean {
    if (typeof navigator === 'undefined') return false
    const ua = navigator.userAgent

    // iOS WebView or Instagram/Facebook in-app browsers often restrict iframe permissions
    const iosWebView = /(iPhone|iPod|iPad).*AppleWebKit(?!.*Safari)/i.test(ua)
    const inAppBrowser = /FBAN|FBAV|Instagram|Twitter|Line|WhatsApp/i.test(ua)

    return iosWebView || inAppBrowser
}

/**
 * Combined check for KYC readiness
 */
export async function checkKycMediaReadiness(): Promise<MediaCheckResult> {
    const mediaCheck = await checkMediaAvailability()

    // If restricted environment and camera available, warn about potential iframe issues
    if (mediaCheck.hasCamera && isRestrictedEnvironment()) {
        return {
            ...mediaCheck,
            message:
                'Camera access in embedded windows may be restricted in this app. For best results, open verification in your browser.',
            severity: 'warning',
        }
    }

    return mediaCheck
}
