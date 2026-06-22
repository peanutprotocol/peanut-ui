import * as Sentry from '@sentry/nextjs'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'

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
        // Native default — unknown/unclassified errors in the app shell.
        default: [
            'Sign in to a Google account on this device',
            'Update Google Play Services',
            'Enable screen lock (Settings > Security)',
            'Restart the app and retry',
        ],
        NotReadableError: [
            'Restart your device',
            'Update Google Play Services',
            'Enable screen lock in Settings > Security',
        ],
        NotAllowedError: [
            "Make sure you're signed in to a Google account on this device",
            'Enable screen lock (Settings > Security)',
            'Update Google Play Services',
            'Turn off VPN or privacy apps temporarily',
        ],
    },
    ios: {
        default: [
            'Enable iCloud Keychain in Settings',
            'Enable Face ID/Touch ID in Settings',
            'Restart the app and retry',
        ],
        NotAllowedError: [
            // First because it's the dominant field case: a wedged third-party
            // credential provider refuses every assertion until unlocked or the
            // device restarts (TASK-20000).
            'If you use a password manager like 1Password, open it and unlock it first',
            'Enable Face ID/Touch ID in Settings',
            'Enable iCloud Keychain in Settings',
            'Turn off VPN temporarily',
            'Restart your device',
        ],
    },
    web: {
        // generic fallback for desktop/unsupported platforms
        default: [
            'Exit Incognito/Private mode',
            'Check your device security settings',
            'Restart your device',
            'Update your browser and OS',
        ],
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
 * Records a WebAuthn ceremony failure during transaction signing (userOp /
 * EIP-712) as a dedicated PostHog event, so the trend is watchable without
 * mining `$exception` by message substring. NotAllowedError dominates: iOS
 * third-party credential providers (1Password) can wedge and refuse every
 * assertion until unlocked or the device restarts (TASK-20000, ~45 users in
 * the 30 days to 2026-06-10). No-ops for non-WebAuthn errors so signing
 * catch blocks can call it without pre-filtering.
 */
const WEBAUTHN_ERROR_NAMES = new Set<string>(Object.values(WebAuthnErrorName))

export function capturePasskeySignFailure(error: unknown, context: string): void {
    if (!(error instanceof Error) || !WEBAUTHN_ERROR_NAMES.has(error.name)) return
    posthog.capture(ANALYTICS_EVENTS.PASSKEY_SIGN_FAILED, { error_name: error.name, context })
}
