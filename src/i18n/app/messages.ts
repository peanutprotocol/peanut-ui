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
    switch (locale) {
        case 'en':
            return en
        case 'es-419':
            return deepMerge(en, (await import('./messages/es-419.json')).default as DeepPartial<AppMessages>)
        // es-AR is deltas-only (voseo / Argentine terms) layered over es-419,
        // so ~2000 shared keys never need re-translating.
        case 'es-AR': {
            const es419 = (await import('./messages/es-419.json')).default as DeepPartial<AppMessages>
            const esAR = (await import('./messages/es-AR.json')).default as DeepPartial<AppMessages>
            return deepMerge(deepMerge(en, es419), esAR)
        }
        case 'pt-BR':
            return deepMerge(en, (await import('./messages/pt-BR.json')).default as DeepPartial<AppMessages>)
    }
}
