import { COUNTRIES_SEO, RECEIVE_SOURCES, SEND_TO_COUNTRIES, countryIso2, getCountryName } from './corridors'
import { SUPPORTED_LOCALES } from '@/i18n/types'

jest.mock('@/lib/content', () => {
    const actual = jest.requireActual('@/lib/content')
    return {
        ...actual,
        listContentSlugs: (intent: string) =>
            actual
                .listContentSlugs(intent)
                .filter((slug: string) => intent !== 'countries' || slug !== 'united-kingdom'),
        readPageContentLocalized: (intent: string, slug: string, locale: string) =>
            intent === 'countries' && slug === 'united-kingdom'
                ? null
                : actual.readPageContentLocalized(intent, slug, locale),
    }
})

describe('UK destinations after the country hub is deleted', () => {
    it('keeps the published send-to and receive-from routes and flag', () => {
        expect(COUNTRIES_SEO['united-kingdom']).toBeUndefined()
        expect(SEND_TO_COUNTRIES).toContain('united-kingdom')
        expect(RECEIVE_SOURCES).toContain('united-kingdom')
        expect(countryIso2('united-kingdom')).toBe('gb')
    })

    it.each(SUPPORTED_LOCALES)('keeps the country name localized in %s', (locale) => {
        expect(getCountryName('united-kingdom', locale)).toBe(locale === 'en' ? 'United Kingdom' : 'Reino Unido')
    })
})
