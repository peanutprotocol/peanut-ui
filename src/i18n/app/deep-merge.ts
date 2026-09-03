export type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] }

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Overlays a (possibly incomplete) locale catalog onto the English one so a
 * missing key always renders English copy, never a raw key path.
 *
 * Lives apart from `messages.ts` because that module statically imports the
 * full 129 KB catalog — anything importing this helper from there would drag it
 * along, which is exactly what the marketing catalogs are avoiding.
 */
export function deepMerge<T>(base: T, override: DeepPartial<T>): T {
    if (!isRecord(base) || !isRecord(override)) return (override ?? base) as T
    const result: Record<string, unknown> = { ...base }
    for (const [key, value] of Object.entries(override)) {
        if (value === undefined || value === null) continue
        const baseValue = result[key]
        result[key] = isRecord(baseValue) && isRecord(value) ? deepMerge(baseValue, value) : value
    }
    return result as T
}
