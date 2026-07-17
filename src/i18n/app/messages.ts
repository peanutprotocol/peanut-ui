import type { AppLocale } from './config'
import en from './messages/en.json'

export type AppMessages = typeof en

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] }

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Overlays a (possibly incomplete) locale catalog onto the English one so a
 * missing key always renders English copy, never a raw key path.
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

export async function loadMessages(locale: AppLocale): Promise<AppMessages> {
    if (locale === 'en') return en
    const overrides =
        locale === 'es-419'
            ? (await import('./messages/es-419.json')).default
            : (await import('./messages/pt-BR.json')).default
    return deepMerge(en, overrides as DeepPartial<AppMessages>)
}
