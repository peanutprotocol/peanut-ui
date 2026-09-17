import { corridorForCountry } from '../countryCorridor'
import { DEPOSIT_RAILS } from '../rails'

const country = (iso2: string, currency: string) => ({ type: 'country' as const, iso2, currency })

describe('corridorForCountry', () => {
    it('matches a single-country rail by its own country code', () => {
        expect(corridorForCountry(country('US', 'USD'))).toBe('ACH_US')
        expect(corridorForCountry(country('GB', 'GBP'))).toBe('FASTER_PAYMENTS_GB')
        expect(corridorForCountry(country('MX', 'MXN'))).toBe('SPEI_MX')
        expect(corridorForCountry(country('BR', 'BRL'))).toBe('PIX_BR')
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

    it('resolves only corridors the rail catalogue actually holds', () => {
        const resolved = corridorForCountry(country('US', 'USD'))
        expect(resolved && DEPOSIT_RAILS[resolved].currency).toBe('USD')
    })
})
