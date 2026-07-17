import { createTranslator } from 'next-intl'
import { APP_LOCALES } from '../config'
import { deepMerge, loadMessages } from '../messages'
import en from '../messages/en.json'
import es419 from '../messages/es-419.json'
import ptBR from '../messages/pt-BR.json'

const CATALOGS = { en, 'es-419': es419, 'pt-BR': ptBR } as const

function leafPaths(obj: Record<string, unknown>, prefix = ''): string[] {
    return Object.entries(obj).flatMap(([key, value]) => {
        const path = prefix ? `${prefix}.${key}` : key
        return typeof value === 'object' && value !== null ? leafPaths(value as Record<string, unknown>, path) : [path]
    })
}

describe('deepMerge fallback', () => {
    it('fills keys missing from a locale catalog with English', async () => {
        const partial = { common: { cancel: 'Cancelar' } }
        const merged = deepMerge(en, partial)
        expect(merged.common.cancel).toBe('Cancelar')
        expect(merged.common.continue).toBe(en.common.continue)
        expect(merged.loadingStates).toEqual(en.loadingStates)
    })

    it('loadMessages returns complete catalogs for every locale', async () => {
        const enPaths = leafPaths(en).sort()
        for (const locale of APP_LOCALES) {
            const messages = await loadMessages(locale)
            expect(leafPaths(messages as unknown as Record<string, unknown>).sort()).toEqual(enPaths)
        }
    })
})

describe('catalog key parity', () => {
    const enPaths = leafPaths(en).sort()
    it.each(APP_LOCALES)('%s has exactly the en key set', (locale) => {
        expect(leafPaths(CATALOGS[locale]).sort()).toEqual(enPaths)
    })
})

describe('ICU message compilation', () => {
    it.each(APP_LOCALES)('every %s message compiles and formats', (locale) => {
        const messages = CATALOGS[locale]
        const invalid: string[] = []
        const t = createTranslator({
            locale,
            messages,
            onError: (error) => {
                // formatting errors from our dummy values are fine; a message
                // that fails to PARSE (e.g. unescaped ICU apostrophe) is not
                if (error.code === 'INVALID_MESSAGE') invalid.push(error.message)
            },
            getMessageFallback: ({ key }) => key,
        })
        // `date` is bound to a Date; a new `{date}` key expecting a preformatted
        // string will format-error (ignored above) — name such params differently.
        const dummy = { count: 2, amount: '10', name: 'Ana', username: 'ana', value: '1', date: new Date(0), days: 3 }
        for (const path of leafPaths(messages)) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            t(path as any, dummy)
        }
        expect(invalid).toEqual([])
    })
})
