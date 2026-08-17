import { localizeMarketingPath, APP_LOCALES } from '../config'
import { SUPPORTED_LOCALES } from '../../types'

describe('localizeMarketingPath', () => {
    it.each([
        ['/en/help/passkeys', 'en', '/en/help/passkeys'],
        ['/en/help/passkeys', 'es-419', '/es-419/help/passkeys'],
        ['/en/help/passkeys', 'pt-BR', '/pt-br/help/passkeys'],
        ['/en/help', 'es-419', '/es-419/help'],
        ['/en/pricing', 'pt-BR', '/pt-br/pricing'],
    ] as const)('%s in %s → %s', (path, locale, expected) => {
        expect(localizeMarketingPath(path, locale)).toBe(expected)
    })

    it.each(['/terms', '/support', '/en', '/english/guide', 'https://peanut.me/en/card-terms-us'])(
        'leaves %p untouched',
        (path) => {
            expect(localizeMarketingPath(path, 'es-419')).toBe(path)
        }
    )

    it('every app locale maps onto a locale the marketing routes generate', () => {
        for (const locale of APP_LOCALES) {
            const segment = localizeMarketingPath('/en/help', locale).split('/')[1]
            expect(SUPPORTED_LOCALES).toContain(segment)
        }
    })
})
