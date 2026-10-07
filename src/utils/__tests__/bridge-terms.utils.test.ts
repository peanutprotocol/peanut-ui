import { bridgeTermsDocuments } from '../bridge-terms.utils'

const LEGAL = 'https://www.bridge.xyz/legal'

describe('bridgeTermsDocuments', () => {
    it('gives a US resident the Bridge Building Inc documents', () => {
        expect(bridgeTermsDocuments('US')).toEqual({
            terms: `${LEGAL}/us-terms/bridge-building-inc`,
            privacy: `${LEGAL}/us-privacy-policy/bridge-building-inc`,
        })
    })

    it.each(['DE', 'pt', 'NO'])('gives an EEA resident (%s) the Bridge Building S.A. documents', (iso2) => {
        expect(bridgeTermsDocuments(iso2)).toEqual({
            terms: `${LEGAL}/eea-user-terms/bridge-building-s-a`,
            privacy: `${LEGAL}/eea-privacy-policy/bridge-building-s-a`,
        })
    })

    it.each(['MX', 'AR', 'GB', 'CH'])('gives a resident of %s the rest-of-world documents', (iso2) => {
        expect(bridgeTermsDocuments(iso2)).toEqual({
            terms: `${LEGAL}/row-user-terms/bridge-building-limited`,
            privacy: `${LEGAL}/row-privacy-policy/bridge-building-limited`,
        })
    })

    it.each([null, undefined, '', 'MC', 'RE'])(
        'falls back to the overview when the residence (%s) is not placed',
        (iso2) => {
            expect(bridgeTermsDocuments(iso2)).toEqual({ terms: `${LEGAL}/overview`, privacy: `${LEGAL}/overview` })
        }
    )
})
