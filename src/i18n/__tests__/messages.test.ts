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
