import { corridorForCountry, corridorsForCountry } from '../countryCorridor'
import { DEPOSIT_RAILS } from '../rails'

const country = (iso2: string, currency: string) => ({ type: 'country' as const, iso2, currency })

describe('corridorForCountry', () => {
    it('matches a single-country rail by its own country code', () => {
        expect(corridorForCountry(country('US', 'USD'))).toBe('ACH_US')
        expect(corridorForCountry(country('GB', 'GBP'))).toBe('FASTER_PAYMENTS_GB')
        expect(corridorForCountry(country('MX', 'MXN'))).toBe('SPEI_MX')
        // Brazil has two, and the catalogue order names the standing one first
        expect(corridorForCountry(country('BR', 'BRL'))).toBe('BANK_TRANSFER_BR')
        expect(corridorForCountry(country('CO', 'COP'))).toBe('BANK_TRANSFER_CO')
        expect(corridorForCountry(country('AR', 'ARS'))).toBe('BANK_TRANSFER_AR')
    })

    it('matches every euro member of the zone rail to the one euro corridor', () => {
        expect(corridorForCountry(country('DE', 'EUR'))).toBe('SEPA_EU')
        expect(corridorForCountry(country('PT', 'EUR'))).toBe('SEPA_EU')
    })

    it('does not hand a currency match to a country the zone does not serve', () => {
        // Ecuador prices in dollars and has no US bank corridor; Peru is not in SEPA
        expect(corridorForCountry(country('EC', 'USD'))).toBeUndefined()
        expect(corridorForCountry(country('PE', 'EUR'))).toBeUndefined()
    })

    it('is not a corridor for the crypto row or for a country with no code', () => {
        expect(corridorForCountry({ type: 'crypto', iso2: undefined, currency: undefined })).toBeUndefined()
        expect(corridorForCountry(country('', 'EUR'))).toBeUndefined()
    })

    it('returns both Brazilian corridors, standing account before one-off top-up', () => {
        expect(corridorsForCountry(country('BR', 'BRL'))).toEqual(['BANK_TRANSFER_BR', 'PIX_BR'])
    })

    it('returns one corridor where a country has one, and none where it has none', () => {
        expect(corridorsForCountry(country('CO', 'COP'))).toEqual(['BANK_TRANSFER_CO'])
        expect(corridorsForCountry(country('DE', 'EUR'))).toEqual(['SEPA_EU'])
        expect(corridorsForCountry(country('NG', 'NGN'))).toEqual([])
    })

    it('resolves only corridors the rail catalogue actually holds', () => {
        const resolved = corridorForCountry(country('US', 'USD'))
        expect(resolved && DEPOSIT_RAILS[resolved].currency).toBe('USD')
    })
})
