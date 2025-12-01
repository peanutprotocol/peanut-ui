/**
 * preflight check for passkey/WebAuthn support
 *
 * performs comprehensive validation before attempting passkey operations
 * provides early feedback to users about potential issues
 */

export interface PasskeyPreflightResult {
    isSupported: boolean
    warning: string | null
    diagnostics: {
        hasPublicKeyCredential: boolean
        isHttps: boolean
        isAndroid: boolean
        chromeVersion?: number
        androidVersion?: string
        deviceModel?: string
        uvpaAvailable?: boolean
        conditionalMediationAvailable?: boolean
    }
}

/**
 * checks if the current environment supports passkeys and identifies common issues
 *
 * @returns preflight result with support status, warnings, and diagnostic data
 */
export async function checkPasskeySupport(): Promise<PasskeyPreflightResult> {
    const diagnostics: PasskeyPreflightResult['diagnostics'] = {
        hasPublicKeyCredential: 'PublicKeyCredential' in window,
        isHttps: window.location.protocol === 'https:' || window.location.hostname === 'localhost',
        isAndroid: /android/i.test(navigator.userAgent),
    }

    // check https (required for webauthn in production)
    if (!diagnostics.isHttps) {
        return {
            isSupported: false,
            warning: 'Passkeys require a secure connection (HTTPS)',
            diagnostics,
        }
    }

    // check if WebAuthn is supported
    if (!diagnostics.hasPublicKeyCredential) {
        return {
            isSupported: false,
            warning: 'Passkeys are not supported on this browser',
            diagnostics,
        }
    }

    // android-specific checks
    if (diagnostics.isAndroid) {
        console.log('[PasskeyPreflight] Android device detected, running additional checks')

        // check chrome version (passkey support requires chrome v108+)
        const chromeMatch = navigator.userAgent.match(/Chrome\/(\d+)/)
        if (chromeMatch) {
            diagnostics.chromeVersion = parseInt(chromeMatch[1])
            console.log('[PasskeyPreflight] Chrome version:', diagnostics.chromeVersion)

            if (diagnostics.chromeVersion < 108) {
                return {
                    isSupported: false,
                    warning: 'Please update Chrome to use passkeys',
                    diagnostics,
                }
            }
        }

        // extract android version for diagnostics
        const androidMatch = navigator.userAgent.match(/Android (\d+(?:\.\d+)?)/)
        if (androidMatch) {
            diagnostics.androidVersion = androidMatch[1]
        }

        // extract device model (e.g., Redmi 13 C shows as "23116RN72Y")
        // user agent format: "Mozilla/5.0 (Linux; Android 14; MODEL_NUMBER) ..."
        const deviceModelMatch = navigator.userAgent.match(/Android [^;]+;\s*([^)]+)\)/)
        if (deviceModelMatch && deviceModelMatch[1]) {
            diagnostics.deviceModel = deviceModelMatch[1].trim()
            console.log('[PasskeyPreflight] Device model:', diagnostics.deviceModel)
        }
    }

    // check for user verifying platform authenticator (critical for android)
    try {
        if (window.PublicKeyCredential?.isUserVerifyingPlatformAuthenticatorAvailable) {
            diagnostics.uvpaAvailable = await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
            console.log(
                '[PasskeyPreflight] User verifying platform authenticator available:',
                diagnostics.uvpaAvailable
            )

            // on android, uvpa must be available (indicates screen lock is properly configured)
            if (!diagnostics.uvpaAvailable && diagnostics.isAndroid) {
                return {
                    isSupported: false,
                    warning: 'Please enable screen lock with PIN or biometric in your device settings',
                    diagnostics,
                }
            }
        }
    } catch (e) {
        console.warn('[PasskeyPreflight] Error checking platform authenticator:', e)
    }

    // check for conditional mediation (better UX indicator, not blocking)
    try {
        if (window.PublicKeyCredential?.isConditionalMediationAvailable) {
            diagnostics.conditionalMediationAvailable =
                await window.PublicKeyCredential.isConditionalMediationAvailable()
            console.log(
                '[PasskeyPreflight] Conditional mediation available:',
                diagnostics.conditionalMediationAvailable
            )
        }
    } catch (e) {
        console.warn('[PasskeyPreflight] Error checking conditional mediation:', e)
    }

    return {
        isSupported: true,
        warning: null,
        diagnostics,
    }
}
