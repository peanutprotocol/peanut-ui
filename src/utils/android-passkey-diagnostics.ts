/** Deliberately excludes credential data, accounts, request IDs and raw messages. */
export function sanitizePasskeyDiagnostics(value: unknown): Record<string, string | number | boolean> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
    const input = value as Record<string, unknown>
    const output: Record<string, string | number | boolean> = {}
    for (const key of ['manufacturer', 'model', 'osVersion', 'appVersion', 'pluginVersion', 'playServicesVersion']) {
        const item = input[key]
        if (typeof item === 'string' && item.length <= 80 && /^[A-Za-z0-9 ._()+-]+$/.test(item)) output[key] = item
    }
    for (const [key, min, max] of [
        ['androidSdk', 1, 100],
        ['durationMs', 0, 600_000],
        ['elapsedMs', 0, 86_400_000],
        ['lateCallbacks', 0, 10_000],
        ['releasedOnCancel', 0, 10_000],
        ['lastLateCallbackMs', 0, 86_400_000],
    ] as const) {
        const item = input[key]
        if (typeof item === 'number' && Number.isInteger(item) && item >= min && item <= max) output[key] = item
    }
    const enums = {
        playServicesStatus: ['available', 'missing', 'disabled', 'outdated', 'invalid', 'unknown'],
        operation: ['get', 'create'],
        outcome: ['success', 'error', 'timeout'],
        phase: ['abandoned', 'cancel_ack', 'released', 'late_settlement', 'native_pending', 'contended_failure'],
        releaseReason: ['ack', 'settled', 'not_pending', 'grace'],
        recovery: ['retried', 'still_pending'],
        lateOutcome: ['success', 'error'],
        contract: ['release', 'confirm', 'none', 'unknown'],
    }
    for (const [key, allowed] of Object.entries(enums)) {
        const item = input[key]
        if (typeof item === 'string' && allowed.includes(item)) output[key] = item
    }
    for (const key of ['cancelSent', 'cancelled', 'released']) {
        if (typeof input[key] === 'boolean') output[key] = input[key] as boolean
    }
    if (typeof input.nativeException === 'string' && /^[A-Za-z]{1,80}$/.test(input.nativeException)) {
        output.nativeException = input.nativeException
    }
    return output
}
