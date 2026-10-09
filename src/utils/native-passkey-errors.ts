// Keep this module free of SDK imports: error rendering and both telemetry sinks use it.
export type NativePasskeyFailure =
    | 'canceled'
    | 'association_unavailable'
    | 'association_mismatch'
    | 'device_locked'
    | 'biometry_required'
    | 'authorization_failed'

export function nativePasskeyFailure(error: unknown): NativePasskeyFailure | undefined {
    const message =
        typeof error === 'string'
            ? error
            : error && typeof error === 'object' && 'message' in error && typeof error.message === 'string'
              ? error.message
              : ''
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
    if (/AuthenticationServices\.AuthorizationError error 1001\b/.test(message)) return 'canceled'
    if (/AuthenticationServices\.AuthorizationError error 1004\b/.test(message)) return 'authorization_failed'
    if (
        /^(?:User cancelled the selector|.*activity is cancelled by the user|\[16\] Cancelled by user\.)$/i.test(
            message
        )
    )
        return 'canceled'
    return undefined
}
