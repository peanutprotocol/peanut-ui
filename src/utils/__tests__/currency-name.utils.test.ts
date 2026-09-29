import { localizedCurrencyName } from '../currency-name.utils'

describe('localizedCurrencyName', () => {
    it('names a currency in the reader language, capitalised as a label', () => {
        expect(localizedCurrencyName('pt-BR', 'GBP', 'British Pound Sterling')).toMatch(/^Libra/)
        expect(localizedCurrencyName('es-419', 'USD', 'US Dollar')).toMatch(/^Dólar/)
        expect(localizedCurrencyName('en', 'MXN', 'Mexican Peso')).toBe('Mexican Peso')
    })

    it('takes the code in any case', () => {
        expect(localizedCurrencyName('pt-BR', 'eur', 'Euro')).toBe('Euro')
    })

    it('keeps the catalog name for a code it cannot name', () => {
        expect(localizedCurrencyName('pt-BR', undefined, 'Fallback')).toBe('Fallback')
        expect(localizedCurrencyName('pt-BR', 'ZZZ', 'Fallback')).toBe('Fallback')
        expect(localizedCurrencyName('pt-BR', 'not-a-code', 'Fallback')).toBe('Fallback')
    })
})
