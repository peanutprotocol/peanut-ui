import { localizedCountryName, localizedCountryTitle } from '../country-name.utils'

describe('localizedCountryName', () => {
    it('translates a known ISO-2 code', () => {
        expect(localizedCountryName('pt-BR', 'BR', 'Brazil')).toBe('Brasil')
        expect(localizedCountryName('es-419', 'US', 'United States')).toMatch(/Estados Unidos/)
    })

    it('keeps the English catalog title in English', () => {
        expect(localizedCountryName('en', 'BR', 'Brazil')).toBe('Brazil')
    })

    it('falls back when there is no code', () => {
        expect(localizedCountryName('pt-BR', undefined, 'Crypto')).toBe('Crypto')
    })

    it('falls back when Intl echoes the code back instead of a name', () => {
        // 'QM' is a valid but unassigned code, so `of` returns 'QM' — never show that.
        expect(localizedCountryName('pt-BR', 'QM', 'Nowhere')).toBe('Nowhere')
    })

    it('falls back when Intl rejects the code outright', () => {
        // `of` throws RangeError on an alpha-3 code.
        expect(localizedCountryName('pt-BR', 'BRA', 'Brazil')).toBe('Brazil')
    })
})

describe('localizedCountryTitle', () => {
    it('reads iso2 off a catalog entry', () => {
        expect(localizedCountryTitle('pt-BR', { iso2: 'DE', title: 'Germany' })).toBe('Alemanha')
    })

    it('keeps the title for the crypto pseudo-entry, which has no iso2', () => {
        expect(localizedCountryTitle('pt-BR', { title: 'Crypto' })).toBe('Crypto')
    })
})
