import { RESIDENCE_RESTRICTION_SETS } from '@/test-utils/residenceRestrictions.fixture'
import {
    deriveRegionAccess,
    getBankRegionIntent,
    getRegionIntent,
    pendingBankRailRegionPaths,
    providerForRegionIntent,
    regionIntentForResidence,
} from '../regions.utils'
import { type RailCapability } from '@/types/capabilities'

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

describe('getBankRegionIntent', () => {
    it('routes Mexico bank flows through the North America intent', () => {
        expect(getBankRegionIntent({ id: 'MX', region: 'latam' })).toBe('NA')
    })

    it('uses the rail jurisdiction for other bank destinations', () => {
        expect(getBankRegionIntent({ id: 'AR', region: 'latam' })).toBe('LATAM')
        expect(getBankRegionIntent({ id: 'BR', region: 'latam' })).toBe('LATAM')
        expect(getBankRegionIntent({ id: 'CO', region: 'latam' })).toBe('LATAM')
        expect(getBankRegionIntent({ id: 'GBR', iso2: 'GB', region: 'europe' })).toBe('EU')
        expect(getBankRegionIntent({ id: 'US', region: 'north-america' })).toBe('NA')
        expect(getBankRegionIntent({ id: 'DE', region: 'europe' })).toBe('EU')
        expect(getBankRegionIntent({ id: 'NG', region: 'rest-of-the-world' })).toBe('ROW')
        expect(getBankRegionIntent({ id: 'XX' })).toBe('ROW')
        expect(getBankRegionIntent(undefined)).toBe('ROW')
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

describe('pendingBankRailRegionPaths', () => {
    const rail = (overrides: Partial<RailCapability>): RailCapability => ({
        id: 'bridge.ach_us',
        provider: 'bridge',
        method: 'ACH_US',
        channel: 'bank',
        country: 'US',
        currency: 'USD',
        status: 'enabled',
        ...overrides,
    })

    it('badges only the region whose bank rail is mid-flight', () => {
        // the regression: a pending AR rail used to badge Europe + North America too
        const paths = pendingBankRailRegionPaths([
            rail({ id: 'manteca.bank_transfer_ar', provider: 'manteca', country: 'AR', status: 'pending' }),
            rail({ id: 'bridge.ach_us', country: 'US', status: 'enabled' }),
        ])
        expect(paths).toEqual(new Set(['latam']))
    })

    it('maps each bank-rail jurisdiction to its region path', () => {
        const paths = pendingBankRailRegionPaths([
            rail({ id: 'bridge.sepa_eu', country: 'EU', status: 'requires-info' }),
            rail({ id: 'bridge.faster_payments_gb', country: 'GB', status: 'pending' }),
            rail({ id: 'bridge.spei_mx', country: 'MX', status: 'pending' }),
            rail({ id: 'manteca.pix_br', provider: 'manteca', country: 'BR', status: 'requires-info' }),
        ])
        expect(paths).toEqual(new Set(['europe', 'north-america', 'latam']))
    })

    it('ignores non-bank channels and settled rails', () => {
        const paths = pendingBankRailRegionPaths([
            rail({
                id: 'rain.card_rain',
                provider: 'rain',
                method: 'CARD_RAIN',
                channel: 'card',
                country: 'GLOBAL',
                status: 'pending',
            }),
            rail({
                id: 'manteca.mercadopago_qr_ar',
                provider: 'manteca',
                channel: 'qr-only',
                country: 'AR',
                status: 'pending',
            }),
            rail({ id: 'bridge.ach_us', country: 'US', status: 'blocked' }),
        ])
        expect(paths.size).toBe(0)
    })
})

describe('regionIntentForResidence', () => {
    it('routes LATAM residences to Manteca and everything Bridge-served to the Bridge levels', () => {
        expect(regionIntentForResidence('BR', RESIDENCE_RESTRICTION_SETS)).toBe('LATAM')
        expect(regionIntentForResidence('ar', RESIDENCE_RESTRICTION_SETS)).toBe('LATAM')
        expect(regionIntentForResidence('US', RESIDENCE_RESTRICTION_SETS)).toBe('NA')
        expect(regionIntentForResidence('MX', RESIDENCE_RESTRICTION_SETS)).toBe('NA')
        expect(regionIntentForResidence('PT', RESIDENCE_RESTRICTION_SETS)).toBe('EU')
        // GB is in Bridge's document map but every bank rail refuses UK residents
        expect(regionIntentForResidence('GB', RESIDENCE_RESTRICTION_SETS)).toBe('ROW')
        expect(regionIntentForResidence('NG', RESIDENCE_RESTRICTION_SETS)).toBe('ROW')
        // Colombia's Manteca rail is deactivated: not LATAM until it comes back
        expect(regionIntentForResidence('CO', RESIDENCE_RESTRICTION_SETS)).toBe('ROW')
    })

    // Same class as the GB block: Bridge lists the country but does not onboard
    // its residents, so a Bridge level could only end on a terminal rejection.
    it('routes a Bridge banking exclusion to the provider-less level', () => {
        expect(regionIntentForResidence('JP', RESIDENCE_RESTRICTION_SETS)).toBe('ROW')
        expect(regionIntentForResidence('dz', RESIDENCE_RESTRICTION_SETS)).toBe('ROW')
    })
})

// TASK-24947 M5: the limits page lists LATAM for any provider that serves it, so a user whose BRL
// account is Avenia's sees its limits there, as a Manteca user does.
describe('deriveRegionAccess unlocks LATAM for an Avenia account', () => {
    const aveniaPix: RailCapability = {
        id: 'avenia.pix_br',
        provider: 'avenia',
        method: 'PIX_BR',
        channel: 'bank',
        country: 'BR',
        currency: 'BRL',
        status: 'enabled',
    }

    it('lists LATAM as unlocked with only an Avenia rail', () => {
        const { unlockedRegions, lockedRegions } = deriveRegionAccess([aveniaPix])
        expect(unlockedRegions.map((region) => region.path)).toContain('latam')
        expect(lockedRegions.map((region) => region.path)).not.toContain('latam')
    })

    it('keeps LATAM locked when the Avenia rail is blocked', () => {
        const { lockedRegions } = deriveRegionAccess([{ ...aveniaPix, status: 'blocked' }])
        expect(lockedRegions.map((region) => region.path)).toContain('latam')
    })
})
