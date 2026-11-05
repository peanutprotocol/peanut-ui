import { isPixQrResidenceBlocked } from './pix-qr-eligibility'

describe('Pix residence presentation acceptance', () => {
    it.each(['BR', 'BRA', 'br', ' bRa '])('blocks declared Brazilian residence before verification: %j', (country) => {
        expect(isPixQrResidenceBlocked({ declared: { country } })).toBe(true)
    })
    it.each(['BR', 'BRA', ' br '])(
        'prefers verified Brazilian residence over declared foreign residence: %j',
        (country) => {
            expect(isPixQrResidenceBlocked({ verified: { country }, declared: { country: 'PT' } })).toBe(true)
        }
    )
    it.each(['PT', 'PRT', 'AR', 'ARG'])('prefers verified non-Brazilian residence: %j', (country) => {
        expect(isPixQrResidenceBlocked({ verified: { country }, declared: { country: 'BR' } })).toBe(false)
    })
    it.each([null, undefined, { verified: null }, { declared: { country: null } }, { declared: { country: 'AR' } }])(
        'does not infer Brazilian residence from missing or other data: %j',
        (residence) => expect(isPixQrResidenceBlocked(residence)).toBe(false)
    )
    it.each([null, undefined, ''])('uses declared country when verified country is absent: %j', (country) => {
        expect(isPixQrResidenceBlocked({ verified: { country }, declared: { country: 'BR' } })).toBe(true)
    })
})
