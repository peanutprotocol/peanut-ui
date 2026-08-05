import { localizeDocsHref } from '../DocsLink'

describe('localizeDocsHref', () => {
    it('re-points /en/ hrefs at the app locale lowercase marketing twin', () => {
        expect(localizeDocsHref('/en/help/passkeys', 'es-419')).toBe('/es-419/help/passkeys')
        expect(localizeDocsHref('/en/help', 'pt-BR')).toBe('/pt-br/help')
        expect(localizeDocsHref('/en', 'es-419')).toBe('/es-419')
    })

    it('leaves English and non-/en/ hrefs untouched', () => {
        expect(localizeDocsHref('/en/help', 'en')).toBe('/en/help')
        expect(localizeDocsHref('/terms', 'es-419')).toBe('/terms')
        expect(localizeDocsHref('/support', 'pt-BR')).toBe('/support')
        expect(localizeDocsHref('https://peanut.me/en/help', 'es-419')).toBe('https://peanut.me/en/help')
    })

    it('does not mangle routes that merely start with en', () => {
        expect(localizeDocsHref('/enterprise', 'es-419')).toBe('/enterprise')
    })
})
