/**
 * Normalize an unknown thrown value into an Error.
 *
 * `catch (err)` gives back `unknown`, and plenty of what we catch is not an
 * Error: qr-scanner rejects with bare strings, viem and several SDKs reject
 * with plain objects. Logging those directly costs us twice —
 * `captureConsoleIntegration` only attaches a stack when one of the console
 * args is an Error instance, and a non-Error object stringifies to the
 * useless `[object Object]`, so the payload is gone as well as the frames.
 *
 * Non-Error objects are serialized rather than stringified, so the shape
 * survives into the Sentry title instead of collapsing.
 */
export function toError(value: unknown): Error {
    if (value instanceof Error) return value

    if (typeof value === 'object' && value !== null) {
        try {
            return new Error(JSON.stringify(value))
        } catch {
            // circular or non-serializable — fall through to String()
        }
    }

    return new Error(String(value))
}
