import { APP_LOCALES } from '../config'
import { toSumsubLocale } from '../sumsub-locale'

describe('toSumsubLocale', () => {
    it.each([
        ['en', 'en'],
        ['es-419', 'es'],
        ['es-AR', 'es'],
        ['pt-BR', 'pt-br'],
    ] as const)('%s → %s', (appLocale, sumsubLocale) => {
        expect(toSumsubLocale(appLocale)).toBe(sumsubLocale)
    })

    it('maps every supported app locale to a Sumsub locale', () => {
        for (const locale of APP_LOCALES) expect(toSumsubLocale(locale)).toBeTruthy()
    })
})
