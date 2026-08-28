import { LOCAL_RESIDENCE_RESTRICTION_SETS } from '@/hooks/useResidenceRestrictionSets'
import { residenceAvailability } from '@/utils/residence-availability'

const sets = LOCAL_RESIDENCE_RESTRICTION_SETS

describe('residenceAvailability', () => {
    it('maps the marquee rail per country and always includes P2P', () => {
        expect(residenceAvailability(sets, 'BR').available).toEqual(['p2p', 'pix', 'card'])
        expect(residenceAvailability(sets, 'AR').available).toEqual(['p2p', 'arQr', 'card'])
        expect(residenceAvailability(sets, 'MX').available).toEqual(['p2p', 'spei', 'card'])
        expect(residenceAvailability(sets, 'US').available).toEqual(['p2p', 'achWire', 'card'])
        expect(residenceAvailability(sets, 'DE').available).toEqual(['p2p', 'sepa', 'card'])
    })

    it('rest of world reads bank transfers where supported, never a specific rail', () => {
        expect(residenceAvailability(sets, 'NG').available).toContain('bank')
    })

    it('restriction tiers surface as unavailable instead of overstating', () => {
        // Banking-only restriction (Bridge does not onboard JP residents)
        const jp = residenceAvailability(sets, 'JP')
        expect(jp.unavailable).toEqual(['banking'])
        expect(jp.available).toEqual(['p2p', 'card'])
        // Card-only restriction (Rain's issuance list)
        const tr = residenceAvailability(sets, 'TR')
        expect(tr.unavailable).toEqual(['card'])
        // Full restriction
        const ru = residenceAvailability(sets, 'RU')
        expect(ru.unavailable).toEqual(['banking', 'card'])
        expect(ru.available).toEqual(['p2p'])
    })

    it('is case-insensitive on input', () => {
        expect(residenceAvailability(sets, 'br').iso2).toBe('BR')
    })
})
