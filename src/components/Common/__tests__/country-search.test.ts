import type { CountryData } from '@/components/AddMoney/consts'
import { matchesCountryQuery } from '../country-search'

const country = (title: string, currency?: string): CountryData => ({
    id: title,
    type: 'country',
    title,
    currency,
    path: title.toLowerCase(),
})

describe('matchesCountryQuery', () => {
    const mexico = country('Mexico', 'MXN')
    const iceland = country('Iceland', 'ISK')
    const germany = country('Germany', 'EUR')

    it('finds a country by the localized name the list shows', () => {
        expect(matchesCountryQuery(iceland, 'isl', 'Islandia')).toBe(true)
        expect(matchesCountryQuery(germany, 'alemania', 'Alemania')).toBe(true)
        expect(matchesCountryQuery(germany, 'isl', 'Alemania')).toBe(false)
    })

    it('finds an accented localized name from a query typed without accents', () => {
        expect(matchesCountryQuery(mexico, 'mexico', 'México')).toBe(true)
        expect(matchesCountryQuery(country('Japan', 'JPY'), 'japon', 'Japón')).toBe(true)
    })

    it('finds an unaccented name from a query typed with accents', () => {
        expect(matchesCountryQuery(mexico, 'méxico', 'Mexico')).toBe(true)
        expect(matchesCountryQuery(country('Spain', 'EUR'), 'españa', 'Espana')).toBe(true)
    })

    it('keeps the English title and the currency code searchable', () => {
        expect(matchesCountryQuery(country('Brazil', 'BRL'), 'brazil', 'Brasil')).toBe(true)
        expect(matchesCountryQuery(germany, 'eur', 'Alemania')).toBe(true)
    })

    it('matches everything on an empty term', () => {
        expect(matchesCountryQuery(mexico, '', 'México')).toBe(true)
    })
})
