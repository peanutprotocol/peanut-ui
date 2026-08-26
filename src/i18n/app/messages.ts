import type { AppLocale } from './config'
import { deepMerge, type DeepPartial } from './deep-merge'
import en from './messages/en.json'

export type AppMessages = typeof en

export { deepMerge, type DeepPartial } from './deep-merge'

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
