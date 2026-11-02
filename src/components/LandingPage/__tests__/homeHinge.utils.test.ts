import { formatArs, formatEur, formatSignedUsd, formatUsd } from '../homeHinge.utils'

// Intl puts a no-break space between code and number in es/pt; compare on plain spaces.
const plain = (s: string) => s.replace(/ /g, ' ')

describe('home hinge amounts, in the reader’s own format', () => {
    it.each([
        ['en', '$3,247.31', '€1,500.00', 'ARS 120,000'],
        ['es-419', 'USD 3.247,31', 'EUR 1.500,00', 'ARS 120.000'],
        ['es-ar', 'USD 3.247,31', 'EUR 1.500,00', 'ARS 120.000'],
        ['pt-br', 'USD 3.247,31', 'EUR 1.500,00', 'ARS 120.000'],
    ] as const)('%s', (locale, usd, eur, ars) => {
        expect(plain(formatUsd(3247.31, locale))).toBe(usd)
        expect(plain(formatEur(1500, locale))).toBe(eur)
        expect(plain(formatArs(120_000, locale))).toBe(ars)
    })

    it('drops the cents for a whole amount', () => {
        expect(formatUsd(250, 'en', { whole: true })).toBe('$250')
        expect(plain(formatUsd(250, 'es-ar', { whole: true }))).toBe('USD 250')
        expect(plain(formatUsd(250, 'pt-br', { whole: true }))).toBe('USD 250')
    })

    it('never prints a bare "$" for pesos', () => {
        for (const locale of ['en', 'es-419', 'es-ar', 'pt-br'] as const) {
            expect(formatArs(120_000, locale)).toMatch(/^ARS/)
        }
    })

    it('signs money in with + and money out with a true minus, whatever the input sign', () => {
        expect(formatSignedUsd(1670.19, 'in', 'en')).toBe('+$1,670.19')
        expect(formatSignedUsd(72.88, 'out', 'en')).toBe('−$72.88')
        expect(formatSignedUsd(-72.88, 'out', 'en')).toBe('−$72.88')
        expect(plain(formatSignedUsd(72.88, 'out', 'pt-br'))).toBe('−USD 72,88')
    })
})
