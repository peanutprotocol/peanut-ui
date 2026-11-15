// Keep this module free of SDK imports: error rendering and both telemetry sinks use it.
export type NativePasskeyFailure =
    | 'canceled'
    | 'association_unavailable'
    | 'association_mismatch'
    | 'device_locked'
    | 'biometry_required'
    | 'authorization_failed'
    | 'setup_required'
    | 'provider_failed'
    | 'credential_missing'

function messageOf(error: unknown): string {
    return typeof error === 'string'
        ? error
        : error && typeof error === 'object' && 'message' in error && typeof error.message === 'string'
          ? error.message
          : ''
}

// iOS localises the sentence around the code: "AuthorizationError error 1001" (en),
// "AuthorizationError 1001)" (es), "AuthorizationError erro 1001." (pt).
const IOS_AUTHORIZATION_ERROR = /AuthenticationServices\.AuthorizationError\D{0,12}(\d{4})\b/

// Every Android message that means the person dismissed the prompt. The plugin
// names all of them NotAllowedError or UnknownError, so the message is the only
// signal; each form below has been seen in production (TASK-24017).
const ANDROID_CANCEL =
    /^(?:User cancelled the selector|.*activity is cancelled by the user|\[16\] Cancelled by user\.|\[16\] Canceled on BiometricPromptFragment\.|User canceled the request|User verification is cancelled by the user\.|This request has been cancelled by the user\.|Client call cancel|Sign in canceled|Passkey (?:registration|authentication) was cancelled\.)$/i
// The phone cannot create a passkey yet: no screen lock, no Google account, no credential provider.
const SETUP_REQUIRED =
    /no create options|no credential available to create|screen lock is missing|no provider dependencies found/i
// The credential provider failed mid-request on its side; the same request can simply be made again.
const PROVIDER_FAILED =
    /unsuccessful result from folsom activity|The UI was interrupted|^\[15\] Flow has timed out|ASCABLEClient\.ClientError|communicate with a helper application/i
// Google Password Manager has no credential for the id it was asked for.
const CREDENTIAL_MISSING = /^\[50156\] Cannot find credential/i

export function nativePasskeyFailure(error: unknown): NativePasskeyFailure | undefined {
    const message = messageOf(error)
    // Specific platform reasons precede the plugin's generic NotAllowedError name.
    if (/Unable to verify webcredentials association of .+ with domain /i.test(message))
        return 'association_unavailable'
    if (/Application with identifier .+ is not associated with domain /i.test(message)) return 'association_mismatch'
    if (/^The operation couldn.t be completed\. Device must be unlocked to perform request\.?$/.test(message))
        return 'device_locked'
    if (
        /^The operation couldn.t be completed\. Stolen Device Protection is enabled and biometry is required\.?$/.test(
            message
        )
    )
        return 'biometry_required'
    const authorization = IOS_AUTHORIZATION_ERROR.exec(message)?.[1]
    if (authorization === '1001') return 'canceled'
    if (authorization === '1004') return 'authorization_failed'
    if (ANDROID_CANCEL.test(message)) return 'canceled'
    if (SETUP_REQUIRED.test(message)) return 'setup_required'
    if (CREDENTIAL_MISSING.test(message)) return 'credential_missing'
    if (PROVIDER_FAILED.test(message)) return 'provider_failed'
    return undefined
}

/**
 * The platform's own error code, e.g. `AuthorizationError:1001` or `android:16`.
 * The plugin reports most native refusals as NotAllowedError; this tells them
 * apart without sending the platform message itself.
 */
export function nativeErrorCode(error: unknown): string | undefined {
    const message = messageOf(error)
    // The word between the class and the number is localised ("error", "erro", none).
    const apple = /\b(\w+Error)\D{1,12}?(-?\d+)\b/.exec(message)
    if (apple) return `${apple[1]}:${apple[2]}`
    const android = /^\[(\d+)\]/.exec(message)
    return android ? `android:${android[1]}` : undefined
}
