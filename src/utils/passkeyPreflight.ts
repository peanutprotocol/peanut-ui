/**
 * preflight check for passkey/WebAuthn support
 *
 * performs comprehensive validation before attempting passkey operations
 * provides early feedback to users about potential issues
 */

import { isCapacitor, getNativeRpId } from '@/utils/capacitor'

/** Catalog keys under `setupRedesign.passkey.preflight`, one per warning below, so screens show it in the user's language. */
export type PasskeyPreflightWarningKey =
    | 'nativeAndroid'
    | 'nativeOther'
    | 'nativeCheckFailed'
    | 'insecure'
    | 'browserUnsupported'
    | 'chromeOutdated'
    | 'androidOutdated'
    | 'screenLock'
    | 'limitedSupport'

export interface PasskeyPreflightResult {
    isSupported: boolean
    /**
     * A language-neutral code for logs and diagnostics (`preflight:<warningKey>`). Screens never show it:
     * they translate `warningKey` from `setupRedesign.passkey.preflight`.
     */
    warning: string | null
    warningKey: PasskeyPreflightWarningKey | null
    diagnostics: {
        hasPublicKeyCredential: boolean
        isHttps: boolean
        isAndroid: boolean
        chromeVersion?: number
        androidVersion?: string
        androidVersionNum?: number
        deviceModel?: string
        uvpaAvailable?: boolean
        conditionalMediationAvailable?: boolean
        rpId?: string
    }
}

/** A result carrying a warning: the catalog key for screens, and `preflight:<key>` for logs. */
const withWarning = (
    isSupported: boolean,
    warningKey: PasskeyPreflightWarningKey,
    diagnostics: PasskeyPreflightResult['diagnostics']
): PasskeyPreflightResult => ({ isSupported, warning: `preflight:${warningKey}`, warningKey, diagnostics })

/**
 * checks if the current environment supports passkeys and identifies common issues
 *
 * @returns preflight result with support status, warnings, and diagnostic data
 */
export async function checkPasskeySupport(): Promise<PasskeyPreflightResult> {
    // in capacitor, passkeys are handled natively. browser-level checks don't
    // apply, but we MUST verify the native credential manager is actually
    // available — otherwise (no signed-in Google account / outdated Google Play
    // Services) registration fails silently and the button appears to "do
    // nothing". Ask the plugin directly so this reflects live device state.
    if (isCapacitor()) {
        const diagnostics: PasskeyPreflightResult['diagnostics'] = {
            hasPublicKeyCredential: true,
            isHttps: true,
            isAndroid: /android/i.test(navigator.userAgent),
            rpId: getNativeRpId(),
        }
        try {
            const { CapacitorPasskey } = await import('@capgo/capacitor-passkey')
            const support = await CapacitorPasskey.isSupported()
            diagnostics.uvpaAvailable = support.available
            diagnostics.conditionalMediationAvailable = support.conditionalMediation
            if (!support.available) {
                return withWarning(false, diagnostics.isAndroid ? 'nativeAndroid' : 'nativeOther', diagnostics)
            }
        } catch (e) {
            console.warn('[PasskeyPreflight] native isSupported() check failed:', e)
            return withWarning(false, 'nativeCheckFailed', diagnostics)
        }
        return { isSupported: true, warning: null, warningKey: null, diagnostics }
    }

    // capture rpId for debugging - this is what will be used for passkey registration
    const rpId = window.location.hostname.replace(/^www\./, '')

    // WebAuthn treats localhost, 127.0.0.1, and [::1] as secure contexts
    // even over plain http. Trust window.isSecureContext first (the
    // browser's own determination) and fall back to the hostname check.
    const hostname = window.location.hostname
    const isLoopback =
        hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]' || hostname === '::1'

    const diagnostics: PasskeyPreflightResult['diagnostics'] = {
        hasPublicKeyCredential: 'PublicKeyCredential' in window,
        isHttps: window.isSecureContext || window.location.protocol === 'https:' || isLoopback,
        isAndroid: /android/i.test(navigator.userAgent),
        rpId,
    }

    console.log('[PasskeyPreflight] rpId that will be used:', rpId)

    // check https (required for webauthn in production)
    if (!diagnostics.isHttps) {
        return withWarning(false, 'insecure', diagnostics)
    }

    // check if WebAuthn is supported
    if (!diagnostics.hasPublicKeyCredential) {
        return withWarning(false, 'browserUnsupported', diagnostics)
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
                return withWarning(false, 'chromeOutdated', diagnostics)
            }
        }

        // extract android version for diagnostics
        const androidMatch = navigator.userAgent.match(/Android (\d+(?:\.\d+)?)/)
        if (androidMatch) {
            diagnostics.androidVersion = androidMatch[1]
            diagnostics.androidVersionNum = parseFloat(androidMatch[1])
            console.log('[PasskeyPreflight] Android version:', diagnostics.androidVersion)

            // android 9 (pie) is minimum for passkeys, but 10+ recommended
            if (diagnostics.androidVersionNum < 9) {
                return withWarning(false, 'androidOutdated', diagnostics)
            }
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
                return withWarning(false, 'screenLock', diagnostics)
            }
        }
    } catch (e) {
        console.warn('[PasskeyPreflight] Error checking platform authenticator:', e)
    }

    // check for conditional mediation (better UX indicator)
    // on android, lack of conditional mediation often indicates outdated play services
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

    // log full diagnostics for debugging android issues
    console.log('[PasskeyPreflight] Full diagnostics:', JSON.stringify(diagnostics, null, 2))

    // return soft warning for android devices without conditional mediation
    // this doesn't block registration but warns user about potential issues
    if (diagnostics.isAndroid && diagnostics.conditionalMediationAvailable === false) {
        return withWarning(true, 'limitedSupport', diagnostics)
    }

    return {
        isSupported: true,
        warning: null,
        warningKey: null,
        diagnostics,
    }
}
