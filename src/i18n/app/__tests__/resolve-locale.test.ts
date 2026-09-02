import { resolveLocale, resolveLocaleOrNull, APP_LOCALES, LOCALE_LABELS } from '../config'

describe('resolveLocale', () => {
    it.each([
        ['en', 'en'],
        ['en-US', 'en'],
        ['en-GB', 'en'],
        ['es-419', 'es-419'],
        ['es-AR', 'es-AR'],
        ['es-ar', 'es-AR'],
        ['es-MX', 'es-419'],
        ['es-ES', 'es-419'],
        ['es', 'es-419'],
        ['pt-BR', 'pt-BR'],
        ['pt-PT', 'pt-BR'],
        ['pt', 'pt-BR'],
        ['ES-419', 'es-419'],
        ['PT-br', 'pt-BR'],
    ] as const)('%s → %s', (input, expected) => {
        expect(resolveLocale(input)).toBe(expected)
    })

    it.each([null, undefined, '', '   ', 'fr-FR', 'de', 'zh-Hans-CN', 'garbage', 'espresso'])(
        'unsupported %p falls back to en',
        (input) => {
            expect(resolveLocale(input)).toBe('en')
        }
    )

    it('every supported locale resolves to itself and has a label', () => {
        for (const locale of APP_LOCALES) {
            expect(resolveLocale(locale)).toBe(locale)
            expect(LOCALE_LABELS[locale]).toBeTruthy()
        }
    })
})

describe('resolveLocaleOrNull', () => {
    it.each([
        ['en-US', 'en'],
        ['es', 'es-419'],
        ['es-AR', 'es-AR'],
        ['ES-ar', 'es-AR'],
        ['pt-PT', 'pt-BR'],
    ] as const)('%s → %s', (input, expected) => {
        expect(resolveLocaleOrNull(input)).toBe(expected)
    })

    it.each([null, undefined, '', '   ', 'fr-FR', 'de', 'garbage', 'espresso'])(
        'unsupported %p is null, not the English fallback',
        (input) => {
            expect(resolveLocaleOrNull(input)).toBeNull()
        }
    )

    it('resolveLocale is the same normalization with the default applied', () => {
        for (const input of ['es-ar', 'pt', 'en-GB', 'fr', '']) {
            expect(resolveLocale(input)).toBe(resolveLocaleOrNull(input) ?? 'en')
        }
    })
})
