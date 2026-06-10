import { getRegionIntent, providerForRegionIntent } from '../regions.utils'

describe('getRegionIntent', () => {
    it('maps each picker path to its 4-bucket intent', () => {
        expect(getRegionIntent('latam')).toBe('LATAM')
        expect(getRegionIntent('rest-of-the-world')).toBe('ROW')
        expect(getRegionIntent('europe')).toBe('EU')
        expect(getRegionIntent('north-america')).toBe('NA')
    })

    it('falls back to ROW for unknown paths', () => {
        expect(getRegionIntent('mars')).toBe('ROW')
        expect(getRegionIntent('')).toBe('ROW')
    })
})

// Mirrors the BE registry (crossRegionProvider in peanut-api-ts
// src/kyc/level-registry.ts) — if these expectations change, the BE
// registry changed and both sides must move together.
describe('providerForRegionIntent', () => {
    it('maps Bridge intents (EU / NA + legacy STANDARD) to bridge', () => {
        expect(providerForRegionIntent('EU')).toBe('bridge')
        expect(providerForRegionIntent('NA')).toBe('bridge')
        expect(providerForRegionIntent('STANDARD')).toBe('bridge')
    })

    it('maps LATAM to manteca', () => {
        expect(providerForRegionIntent('LATAM')).toBe('manteca')
    })

    it('maps ROW to null — no provider serves rest-of-world (the no-op-loop regression)', () => {
        // ROW must NOT fall back to a provider: the old `EU/NA ? bridge : manteca`
        // copy made a Manteca-verified user's ROW click look same-provider,
        // dropping the crossRegion flag and silently no-op'ing the request.
        expect(providerForRegionIntent('ROW')).toBeNull()
        expect(providerForRegionIntent(undefined)).toBeNull()
    })
})
