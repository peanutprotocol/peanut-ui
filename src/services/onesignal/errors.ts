export class OneSignalConfigError extends Error {
    name = 'OneSignalConfigError'
}

const PERMANENT_PLUGIN_CODES = new Set(['UNIMPLEMENTED', 'UNAVAILABLE'])

// Messages the web SDK throws for a site/app configuration it will never accept.
const PERMANENT_MESSAGES = [
    /^Can only be used on: /,
    /^App not configured for web push$/,
    /^SDK already initialized$/,
    /^OneSignal configuration missing/,
]

/** True for init failures that a retry in this document can never fix. */
export function isPermanentOneSignalInitError(error: unknown): boolean {
    if (error instanceof OneSignalConfigError) return true
    const code = (error as { code?: unknown } | null)?.code
    if (typeof code === 'string' && PERMANENT_PLUGIN_CODES.has(code)) return true
    const message = error instanceof Error ? error.message : String(error ?? '')
    return PERMANENT_MESSAGES.some((pattern) => pattern.test(message))
}
