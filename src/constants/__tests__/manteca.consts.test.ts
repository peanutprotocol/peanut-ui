import {
    MANTECA_SUPPORTED_EXCHANGES,
    isMantecaCountry,
    isMantecaSupportedCountryCode,
} from '@/constants/manteca.consts'

describe('manteca supported country helpers', () => {
    test('mirrors the backend supported country set', () => {
        expect(Object.keys(MANTECA_SUPPORTED_EXCHANGES)).toEqual(['AR', 'BR'])
    })

    test('allows only argentina and brazil paths for manteca routing', () => {
        expect(isMantecaCountry('argentina')).toBe(true)
        expect(isMantecaCountry('brazil')).toBe(true)

        for (const countryPath of ['bolivia', 'chile', 'colombia', 'mexico', 'panama', 'costa-rica']) {
            expect(isMantecaCountry(countryPath)).toBe(false)
        }
    })

    test('allows only ar and br country codes for manteca routing', () => {
        expect(isMantecaSupportedCountryCode('AR')).toBe(true)
        expect(isMantecaSupportedCountryCode('BR')).toBe(true)
        expect(isMantecaSupportedCountryCode('ar')).toBe(true)

        for (const countryCode of ['BO', 'CL', 'CO', 'MX', 'PA', 'CR', 'GT', 'PH', 'PE']) {
            expect(isMantecaSupportedCountryCode(countryCode)).toBe(false)
        }
    })

    test('rejects empty inputs', () => {
        expect(isMantecaCountry(null)).toBe(false)
        expect(isMantecaSupportedCountryCode(undefined)).toBe(false)
    })
})
