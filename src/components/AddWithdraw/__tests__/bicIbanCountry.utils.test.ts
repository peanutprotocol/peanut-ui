import { bicMatchesIbanCountry } from '../bicIbanCountry.utils'

describe('bicMatchesIbanCountry', () => {
    it('accepts a BIC from the IBAN country', () => {
        expect(bicMatchesIbanCountry('DEUTDEFF', 'DE89 3704 0044 0532 0130 00')).toBe(true)
        expect(bicMatchesIbanCountry('deutdeffxxx', 'de89370400440532013000')).toBe(true)
    })

    it('refuses a BIC from another country', () => {
        expect(bicMatchesIbanCountry('CAIXESBB', 'DE89370400440532013000')).toBe(false)
    })

    // their banks issue IBANs under the other country's code
    it.each([
        ['BNPAMCM1', 'FR7630004000031234567890143'],
        ['RBOSJESH', 'GB29NWBK60161331926819'],
        ['AABAAXXX', 'FI2112345600000785'],
    ])('accepts the territory pair %s / %s', (bic, iban) => {
        expect(bicMatchesIbanCountry(bic, iban)).toBe(true)
    })

    it('does not judge a pair it cannot read', () => {
        expect(bicMatchesIbanCountry('DEUT', 'DE89370400440532013000')).toBe(true)
        expect(bicMatchesIbanCountry('DEUTDEFF', '')).toBe(true)
        expect(bicMatchesIbanCountry('DEUT12FF', 'DE89370400440532013000')).toBe(true)
    })
})
