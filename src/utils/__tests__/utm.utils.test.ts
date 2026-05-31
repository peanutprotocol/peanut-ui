import { withUtm, UTM_SOURCES, UTM_MEDIUMS, type UtmParams } from '@/utils/utm.utils'

const utm: UtmParams = {
    source: UTM_SOURCES.MERCHANT_LANDING,
    medium: UTM_MEDIUMS.MERCHANT,
    campaign: 'stain',
}

describe('withUtm', () => {
    it('appends UTM params with `?` when the path has no query', () => {
        expect(withUtm('/m/stain', utm)).toBe('/m/stain?utm_source=m&utm_medium=merchant&utm_campaign=stain')
    })

    it('appends with `&` when the path already has a query', () => {
        expect(withUtm('/m/stain?code=abc', utm)).toBe(
            '/m/stain?code=abc&utm_source=m&utm_medium=merchant&utm_campaign=stain'
        )
    })

    it('keeps a #fragment after the UTM params instead of dropping them', () => {
        // Regression: a naive concat would put `?utm…` after `#menu`, where the
        // browser treats it as part of the fragment and the UTMs never reach PostHog.
        expect(withUtm('/m/stain#menu', utm)).toBe('/m/stain?utm_source=m&utm_medium=merchant&utm_campaign=stain#menu')
    })

    it('handles a query AND a fragment together', () => {
        expect(withUtm('/m/stain?code=abc#menu', utm)).toBe(
            '/m/stain?code=abc&utm_source=m&utm_medium=merchant&utm_campaign=stain#menu'
        )
    })

    it('puts extra params before the UTM params', () => {
        expect(withUtm('/claim', utm, { id: 'xyz' })).toBe(
            '/claim?id=xyz&utm_source=m&utm_medium=merchant&utm_campaign=stain'
        )
    })
})
