// Shared leaf predicate: importing it from PostHog startup must not load Sentry.
type Exception = { type?: string; value?: string }
const REPORTED_WRAPPERS = new Set(['ServiceUnavailableError', 'ConnectionTimeoutError', 'PasskeyError'])

export function isExpectedCancellation(value: string | undefined): boolean {
    return (
        !!value &&
        (/\buser (?:rejected|denied|cancelled|canceled)\b/i.test(value) ||
            /\bactivity is cancelled by the user\b/i.test(value) ||
            /AuthenticationServices\.AuthorizationError error 1001\b/.test(value) ||
            /^\[16\] Canceled on BiometricPromptFragment\.$/.test(value) ||
            /^No matching passkey was found\.$/.test(value))
    )
}

export function isExpectedExceptionChain(exceptions: readonly Exception[]): boolean {
    // Our wrappers follow a fetch-site or classified passkey capture. Seeing
    // the same cause again at the global handler adds no new failure.
    if (exceptions.some((exception) => REPORTED_WRAPPERS.has(exception.type ?? ''))) return true
    return exceptions.length > 0 && exceptions.every((exception) => isExpectedCancellation(exception.value))
}
