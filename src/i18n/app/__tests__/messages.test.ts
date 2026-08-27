import { createTranslator } from 'next-intl'
import { APP_LOCALES, type AppLocale } from '../config'
import { deepMerge, loadMessages } from '../messages'
import en from '../messages/en.json'
import es419 from '../messages/es-419.json'
import esAR from '../messages/es-AR.json'
import ptBR from '../messages/pt-BR.json'
import { leafPaths, leafValue } from './catalog-helpers'

const CATALOGS = { en, 'es-419': es419, 'es-AR': esAR, 'pt-BR': ptBR } as const

// es-AR is a deltas-only overlay on es-419 (see loadMessages), so its raw file
// holds a subset of the en key set rather than all of it.
const DELTA_LOCALES: readonly AppLocale[] = ['es-AR']
const FULL_LOCALES = APP_LOCALES.filter((locale) => !DELTA_LOCALES.includes(locale))

/**
 * English strings that legitimately carry more than one translation. Spanish and
 * Portuguese make distinctions English collapses, so these keys must NOT be merged
 * into one — doing so ships the wrong part of speech or the wrong gender.
 */
const CONTEXT_DIVERGENT: Record<string, string> = {
    Send: 'nav/action verb vs. transaction-type noun (Enviar / Envío)',
    Request: 'nav/action verb vs. transaction-type noun (Recibir / Solicitud)',
    Add: 'nav verb vs. transaction-type noun (Agregar / Ingreso)',
    Withdraw: 'nav verb vs. transaction-type noun (Retirar / Retiro)',
    Pay: 'nav/action verb vs. transaction-type noun (Pagar / Pago)',
    Claim: 'nav verb vs. transaction-type noun (Reclamar / Reclamo)',
    Receive: 'action verb vs. transaction-type noun (Recibir / Recepción)',
    Join: 'standalone CTA vs. sentence fragment completed by a team name',
    Processing: 'generic in-flight status vs. KYC under-review status (En proceso)',
    Failed: 'generic status vs. KYC status agreeing with "verificación" (Fallido / Fallida)',
    'Settings → Passwords → Search "Peanut"': 'iOS and Android name the settings app differently',
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

    it('es-AR inherits es-419 for keys it does not override', async () => {
        const messages = await loadMessages('es-AR')
        expect(messages.common.cancel).toBe(es419.common.cancel)
    })
})

describe('catalog key parity', () => {
    const enPaths = leafPaths(en).sort()
    it.each(FULL_LOCALES)('%s has exactly the en key set', (locale) => {
        expect(leafPaths(CATALOGS[locale]).sort()).toEqual(enPaths)
    })

    it.each(DELTA_LOCALES)('%s holds only keys that exist in en', (locale) => {
        const stray = leafPaths(CATALOGS[locale]).filter((path) => !enPaths.includes(path))
        expect(stray).toEqual([])
    })
})

describe('duplicate-value drift', () => {
    const groups = new Map<string, string[]>()
    for (const path of leafPaths(en)) {
        const value = leafValue(en, path)
        groups.set(value, [...(groups.get(value) ?? []), path])
    }
    const duplicated = [...groups.entries()].filter(
        ([value, paths]) => paths.length > 1 && !(value in CONTEXT_DIVERGENT)
    )

    // Resolved catalogs, not raw files — es-AR is a delta, so a partial override
    // of a duplicate group only shows up once es-419 has been merged underneath.
    it.each(APP_LOCALES.filter((locale) => locale !== 'en'))(
        'keys sharing an English string share the same %s translation',
        async (locale) => {
            const messages = (await loadMessages(locale)) as unknown as Record<string, unknown>
            const drifted = duplicated
                .map(([value, paths]) => ({
                    value,
                    renderings: [...new Set(paths.map((path) => leafValue(messages, path)))],
                    paths,
                }))
                .filter(({ renderings }) => renderings.length > 1)

            // Either collapse the keys onto one canonical key, or — if the strings
            // genuinely differ by context — add the English to CONTEXT_DIVERGENT.
            expect(drifted).toEqual([])
        }
    )
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
        const dummy = {
            count: 2,
            amount: '10',
            name: 'Ana',
            username: 'ana',
            value: '1',
            date: new Date(0),
            days: 3,
            minutes: 2,
        }
        for (const path of leafPaths(messages)) {
            t(path as any, dummy)
        }
        expect(invalid).toEqual([])
    })
})
