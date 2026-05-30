import { describe, it, expect } from '@jest/globals'
import { getRouteForPathname, ROUTES } from '../routes'
import { buildShareUrl } from '../share.consts'
import { getMerchantBySlug } from '@/app/m/[slug]/merchants'

describe('routes', () => {
    it('resolves known pathnames to route configs', () => {
        expect(getRouteForPathname('/home')).toBeDefined()
        expect(getRouteForPathname('/card')).toBeDefined()
    })

    it('returns undefined for unknown pathnames', () => {
        expect(getRouteForPathname('/nonexistent-xyz')).toBeUndefined()
    })
})

describe('buildShareUrl', () => {
    it('builds a share url with the given code', () => {
        expect(buildShareUrl('ABC123')).toContain('ABC123')
    })
})

describe('merchant routing', () => {
    it('resolves a known merchant slug', () => {
        expect(getMerchantBySlug('stain')).toBeDefined()
    })

    it('returns undefined for an unknown merchant slug', () => {
        expect(getMerchantBySlug('nope-xyz')).toBeUndefined()
    })
})
