import { SUPPORTED_LOCALES, DEFAULT_LOCALE, type Locale } from '../types'
import { getTranslations, t } from '../index'

// The Translations interface makes a MISSING key a compile error, but nothing
// catches a stale EXTRA key or an empty string, so assert both here.
describe('marketing message catalogs', () => {
    const enKeys = Object.keys(getTranslations(DEFAULT_LOCALE)).sort()

    it.each(SUPPORTED_LOCALES)('%s has exactly the en key set', (locale) => {
        expect(Object.keys(getTranslations(locale)).sort()).toEqual(enKeys)
    })

    it.each(SUPPORTED_LOCALES)('%s has no empty or untrimmed values', (locale) => {
        const messages = getTranslations(locale) as unknown as Record<string, string>
        for (const [key, value] of Object.entries(messages)) {
            expect(typeof value).toBe('string')
            expect(`${locale}/${key}:${value}`).not.toBe(`${locale}/${key}:`)
            expect(`${locale}/${key}:${value}`).toBe(`${locale}/${key}:${value.trim()}`)
        }
    })

    it.each(SUPPORTED_LOCALES)('%s keeps every {placeholder} from en', (locale) => {
        const en = getTranslations(DEFAULT_LOCALE) as unknown as Record<string, string>
        const messages = getTranslations(locale) as unknown as Record<string, string>
        const placeholders = (s: string) => (s.match(/\{(\w+)\}/g) ?? []).sort()

        for (const key of enKeys) {
            expect({ key, placeholders: placeholders(messages[key]) }).toEqual({
                key,
                placeholders: placeholders(en[key]),
            })
        }
    })

    // the no-fees lettering used to be baked into an SVG, so it silently stayed
    // English on every locale — assert it is translated everywhere
    it.each(SUPPORTED_LOCALES.filter((locale) => locale !== DEFAULT_LOCALE))(
        '%s translates the no-fees lettering',
        (locale) => {
            const en = getTranslations(DEFAULT_LOCALE)
            const messages = getTranslations(locale)
            expect(messages.landingReallyZero).not.toBe(en.landingReallyZero)
            expect(messages.landingNoHiddenFees).not.toBe(en.landingNoHiddenFees)
        }
    )

    it.each(SUPPORTED_LOCALES)('%s keeps the no-fees lettering uppercase', (locale) => {
        const messages = getTranslations(locale)
        expect(messages.landingReallyZero).toBe(messages.landingReallyZero.toUpperCase())
        expect(messages.landingNoHiddenFees).toBe(messages.landingNoHiddenFees.toUpperCase())
    })

    // the scribble is drawn around the closing word, so every catalog needs one
    it.each(SUPPORTED_LOCALES)('%s puts a circleable word last in landingReallyZero', (locale) => {
        expect(getTranslations(locale).landingReallyZero).toMatch(/\s\S+$/)
    })

    it('falls back to en for an unsupported locale', () => {
        expect(getTranslations('de' as Locale)).toBe(getTranslations(DEFAULT_LOCALE))
    })
})

describe('t()', () => {
    it('interpolates named placeholders', () => {
        expect(t('Send to {name}', { name: 'Argentina' })).toBe('Send to Argentina')
    })

    it('leaves unknown placeholders intact rather than printing undefined', () => {
        expect(t('Send to {name}', {})).toBe('Send to {name}')
    })
})
