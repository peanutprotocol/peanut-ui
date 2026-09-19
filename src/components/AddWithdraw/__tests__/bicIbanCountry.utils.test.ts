import { bicCountryDiffersFromIban } from '../bicIbanCountry.utils'

/*
 * This started life as a refusal, and refused accounts that work: a BIC
 * registered in another member state than the IBAN is what passporting looks
 * like. It is a note under the field now, so the only question it answers is
 * whether the note is worth showing.
 */
describe('bicCountryDiffersFromIban', () => {
    it('says nothing about a BIC from the IBAN country', () => {
        expect(bicCountryDiffersFromIban('DEUTDEFF', 'DE89 3704 0044 0532 0130 00')).toBe(false)
        expect(bicCountryDiffersFromIban('deutdeffxxx', 'de89370400440532013000')).toBe(false)
    })

    it('notes a BIC from another country', () => {
        expect(bicCountryDiffersFromIban('CAIXESBB', 'DE89370400440532013000')).toBe(true)
    })

    // their banks issue IBANs under the other country's code
    it.each([
        ['BNPAMCM1', 'FR7630004000031234567890143'],
        ['RBOSJESH', 'GB29NWBK60161331926819'],
        ['AABAAXXX', 'FI2112345600000785'],
    ])('says nothing about the territory pair %s / %s', (bic, iban) => {
        expect(bicCountryDiffersFromIban(bic, iban)).toBe(false)
    })

    it('does not judge a pair it cannot read', () => {
        expect(bicCountryDiffersFromIban('DEUT', 'DE89370400440532013000')).toBe(false)
        expect(bicCountryDiffersFromIban('DEUTDEFF', '')).toBe(false)
        expect(bicCountryDiffersFromIban('DEUT12FF', 'DE89370400440532013000')).toBe(false)
    })
})
