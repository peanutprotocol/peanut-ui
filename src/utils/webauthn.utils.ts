import * as Sentry from '@sentry/nextjs'

/**
 * Retry configuration for WebAuthn operations
 *
 * WHY: Android Credential Manager has transient NotReadableError issues
 * - Google Chrome bug: https://bugs.chromium.org/p/chromium/issues/detail?id=1369230
 * - GitHub discussion: https://github.com/github/webauthn-json/issues/91
 * - Workaround: preventSilentAccess() used by GitHub/Microsoft/Google
 *
 * MONITORING: Check Sentry for "passkey-registration retry attempt" events
 * - High retry rate (>10%) = investigate root cause
 * - Low success rate (<30%) = retry might not help, needs deeper fix
 */
const WEBAUTHN_RETRY_CONFIG = {
    maxRetries: 2, // Limited to prevent infinite loops
    retryDelay: 1000, // 1s - balance between UX and OS recovery time
    retriableErrors: ['NotReadableError'], // ONLY NotReadableError (transient Android issue)
}

export enum WebAuthnErrorName {
    NotAllowed = 'NotAllowedError',
    NotReadable = 'NotReadableError',
    InvalidState = 'InvalidStateError',
    NotSupported = 'NotSupportedError',
}

/**
 * Delays execution for specified milliseconds
 */
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Wraps WebAuthn operations with automatic retry for transient Android errors
 *
 * @param operation - Async function to execute (e.g., () => handleRegister(username))
 * @param operationName - Name for Sentry logging (e.g., 'passkey-registration')
 * @param maxRetries - Max retry attempts (default: 2)
 * @returns Result of the operation
 */
export async function withWebAuthnRetry<T>(
    operation: () => Promise<T>,
    operationName: string = 'webauthn-operation',
    maxRetries: number = WEBAUTHN_RETRY_CONFIG.maxRetries
): Promise<T> {
    let lastError: Error | undefined

    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
        try {
            const result = await operation()

            // Success - log if it was a retry
            if (attempt > 1) {
                Sentry.captureMessage(`${operationName} succeeded on retry ${attempt - 1}`, {
                    level: 'info',
                    extra: { attempt, maxRetries },
                })
            }

            return result
        } catch (error) {
            lastError = error as Error
            const isLastAttempt = attempt > maxRetries

            // Check if error is retriable
            const isRetriable = WEBAUTHN_RETRY_CONFIG.retriableErrors.includes(lastError.name)

            if (!isRetriable || isLastAttempt) {
                // Not retriable or no more retries - throw immediately
                throw lastError
            }

            // Log retry attempt to Sentry for monitoring
            Sentry.captureMessage(`${operationName} retry attempt`, {
                level: 'warning',
                extra: {
                    errorName: lastError.name,
                    errorMessage: lastError.message,
                    attempt,
                    maxRetries,
                    willRetry: true,
                },
            })

            // Android workaround: Clear any stuck credential prompts
            if (typeof navigator !== 'undefined' && navigator.credentials?.preventSilentAccess) {
                try {
                    await navigator.credentials.preventSilentAccess()
                } catch (e) {
                    // Silent fail - this is a best-effort workaround
                    console.warn('preventSilentAccess failed:', e)
                }
            }

            // Wait before retrying
            await delay(WEBAUTHN_RETRY_CONFIG.retryDelay)
        }
    }

    // Should never reach here, but TypeScript needs this
    throw lastError || new Error(`${operationName} failed after ${maxRetries} retries`)
}

/**
 * User-friendly error messages for WebAuthn errors
 *
 * Sources:
 * - W3C WebAuthn spec error definitions: https://www.w3.org/TR/webauthn-3/#sctn-op-make-cred
 * - MDN WebAuthn errors: https://developer.mozilla.org/en-US/docs/Web/API/Web_Authentication_API
 *
 * NotAllowedError can occur even with screen lock enabled due to:
 * 1. User explicitly cancelled the passkey prompt
 * 2. Browser timeout (user didn't respond within ~60s)
 * 3. Private/Incognito mode restrictions (some browsers)
 * 4. iCloud Keychain disabled on iOS (even with Face ID enabled)
 * 5. Credential manager disabled in browser settings
 * 6. Cross-origin iframe context issues
 * 7. Invalid RP ID (domain mismatch)
 * 8. Browser treating rapid attempts as spam/duplicate
 * 9. Platform authenticator locked or unavailable (despite screen lock)
 * 10. Browser extension interference (password managers, etc.)
 */
const WEBAUTHN_ERROR_MESSAGES: Record<string, string> = {
    NotAllowedError:
        'Passkey setup was blocked. Make sure your device is up to date and has the latest security updates.',
    NotReadableError: 'Credential manager is busy. Please try again.',
    UnknownError: 'Unable to create passkey. Please try again.',
    InvalidStateError: 'A passkey already exists for this device.',
    NotSupportedError: 'Passkeys are not supported on this device.',
    SecurityError: 'Security error. Please ensure you are using HTTPS.',
    AbortError: 'Operation cancelled. Please try again.',
    TimeoutError: 'Operation timed out. Please try again.',
}

/**
 * Platform-specific troubleshooting steps for common issues
 *
 * IMPORTANT: These are suggestions based on community reports, not official fixes
 * Sources:
 * - Android NotReadableError: https://github.com/w3c/webauthn/issues/1879
 * - Community discussions: Stack Overflow, GitHub issues from major implementations
 *
 * ANDROID SECURITY PATCHES ISSUE:
 * - Budget Android devices (Redmi, Realme, etc.) often stop receiving security updates after 1-2 years
 * - Google Play Services (which handles WebAuthn) requires recent security patches for full passkey support
 * - Devices with security patches >6 months old may have outdated Play Services with WebAuthn bugs
 * - This is especially common on devices <$200 where OEMs abandon update support quickly
 * - User will see NotAllowedError even with screen lock enabled if Play Services is outdated
 *
 * RISK: If Android/iOS change their credential manager behavior, these may become outdated
 */
export const PASSKEY_TROUBLESHOOTING_STEPS = {
    android: {
        NotReadableError: [
            'Restart your device',
            'Update Google Play Services',
            'Enable screen lock in Settings > Security',
        ],
        NotAllowedError: [
            'Enable screen lock (Settings > Security)',
            'Update Google Play Services and Chrome',
            'Check for system security updates',
            'Disable third-party password managers temporarily',
        ],
    },
    ios: {
        NotAllowedError: [
            'Enable Face ID/Touch ID in Settings',
            'Enable iCloud Keychain in Settings',
            'Use Safari browser',
        ],
    },
    web: {
        // generic fallback for desktop/unsupported platforms
        default: ['Check your device security settings', 'Restart your device', 'Update your browser and OS'],
    },
} as const

/**
 * Platform-specific warnings for common issues
 */
export const PASSKEY_WARNINGS = {
    android: {
        NotAllowedError: 'Lower end Android devices may require recent security updates for passkeys to work properly.',
    },
} as const

/**
 * Helper to format steps as text (for inline error messages)
 */
const formatStepsAsText = (steps: readonly string[]): string => {
    return `Try these fixes:\n${steps.map((step) => `• ${step}`).join('\n')}`
}

/**
 * Gets a user-friendly error message with platform-specific guidance
 *
 * @param error - The WebAuthn error
 * @param deviceType - Optional device type from useDeviceType() hook. If not provided, uses basic detection
 * @returns User-friendly error message with platform-specific help if applicable
 *
 * NOTE: This is a utility function that can work both with and without React context
 * Prefer passing deviceType from useDeviceType() hook when available for better detection
 */
export function getWebAuthnErrorMessage(error: Error, deviceType?: 'ios' | 'android' | 'web'): string {
    const baseMessage = WEBAUTHN_ERROR_MESSAGES[error.name] || error.message

    // if no deviceType provided, do basic detection (fallback)
    let platform: 'android' | 'ios' | 'web' = 'web'
    if (deviceType) {
        platform = deviceType
    } else if (typeof navigator !== 'undefined') {
        const ua = navigator.userAgent
        if (/android/i.test(ua)) platform = 'android'
        else if (/iPhone|iPad|iPod/i.test(ua)) platform = 'ios'
    }

    // add platform-specific help for known issues
    const steps =
        platform === 'android' && error.name in PASSKEY_TROUBLESHOOTING_STEPS.android
            ? PASSKEY_TROUBLESHOOTING_STEPS.android[error.name as keyof typeof PASSKEY_TROUBLESHOOTING_STEPS.android]
            : platform === 'ios' && error.name in PASSKEY_TROUBLESHOOTING_STEPS.ios
              ? PASSKEY_TROUBLESHOOTING_STEPS.ios[error.name as keyof typeof PASSKEY_TROUBLESHOOTING_STEPS.ios]
              : null

    if (steps) {
        const formattedSteps = formatStepsAsText(steps)
        // add warning if exists
        const warning =
            platform === 'android' &&
            error.name in PASSKEY_WARNINGS.android &&
            PASSKEY_WARNINGS.android[error.name as keyof typeof PASSKEY_WARNINGS.android]

        return warning
            ? `${baseMessage}\n\n${formattedSteps}\n\nNote: ${warning}`
            : `${baseMessage}\n\n${formattedSteps}`
    }

    return baseMessage
}
