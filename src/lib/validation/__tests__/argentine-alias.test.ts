import { isArgentinePaymentAlias } from '@/lib/validation/argentine-alias'

describe('isArgentinePaymentAlias', () => {
    it.each([
        ['CASA.FUTBOLERA', 'uppercase alias'],
        ['casa.futbolera', 'lowercase alias'],
        ['mi.alias.uala', 'three-label alias'],
        ['juan-perez.bna', 'alias with a dash'],
    ])('claims %s (%s)', (value) => {
        expect(isArgentinePaymentAlias(value)).toBe(true)
    })

    it.each([
        ['vitalik.eth', 'ENS name of the same shape'],
        ['sub.vitalik.eth', 'ENS subname'],
        ['hugo0.peanut.me', 'Peanut subname'],
        ['example.com', 'DNS-backed ENS name'],
        ['juan.perez.mp', 'alias-shaped name under a real ccTLD'],
        ['test..eth', 'malformed name in a real namespace'],
        ['kusharc', 'no dot — a username'],
        ['a.b', 'under the 6-character floor'],
        ['this.alias.is.far.too.long.to.be.one', 'over the 20-character ceiling'],
        ['casa@futbolera', 'character outside the alias set'],
    ])('does not claim %s (%s)', (value) => {
        expect(isArgentinePaymentAlias(value)).toBe(false)
    })
})
