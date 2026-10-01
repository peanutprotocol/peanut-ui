import {
    getBankRegionIntent,
    getRegionIntent,
    isVerifiedForCountry,
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
        expect(regionIntentForResidence('BR')).toBe('LATAM')
        expect(regionIntentForResidence('ar')).toBe('LATAM')
        expect(regionIntentForResidence('US')).toBe('NA')
        expect(regionIntentForResidence('MX')).toBe('NA')
        expect(regionIntentForResidence('PT')).toBe('EU')
        // GB is in Bridge's document map but every bank rail refuses UK residents
        expect(regionIntentForResidence('GB')).toBe('ROW')
        expect(regionIntentForResidence('NG')).toBe('ROW')
        // Colombia's Manteca rail is deactivated: not LATAM until it comes back
        expect(regionIntentForResidence('CO')).toBe('ROW')
    })

    // Same class as the GB block: Bridge lists the country but does not onboard
    // its residents, so a Bridge level could only end on a terminal rejection.
    it('routes a Bridge banking exclusion to the provider-less level', () => {
        expect(regionIntentForResidence('JP')).toBe('ROW')
        expect(regionIntentForResidence('dz')).toBe('ROW')
    })
})

/**
 * QA 2026-09-24 (QA-12): a verified user who is not Brazilian holds the Pix
 * rail at pool tier — `pay` on, `deposit` and `withdraw` waiting on a full
 * account. Reading `deposit` for every flow told them Pix was closed while
 * they could pay any Pix key.
 */
describe('isVerifiedForCountry reads the operation the flow runs', () => {
    const pixRail = (operations: RailCapability['operations']): RailCapability => ({
        id: 'manteca.pix_br',
        provider: 'manteca',
        method: 'PIX_BR',
        channel: 'bank',
        country: 'BR',
        currency: 'BRL',
        status: 'enabled',
        operations,
    })
    const poolTier = [pixRail({ pay: 'enabled', deposit: 'requires-info', withdraw: 'requires-info' })]
    const fullTier = [pixRail({ pay: 'enabled', deposit: 'enabled', withdraw: 'enabled' })]

    it('pool tier: paying a Pix key is open, adding and own-account withdraw are not', () => {
        expect(isVerifiedForCountry(poolTier, 'BR', 'pay')).toBe(true)
        expect(isVerifiedForCountry(poolTier, 'BR', 'deposit')).toBe(false)
        expect(isVerifiedForCountry(poolTier, 'BR', 'withdraw')).toBe(false)
    })

    it('full tier: every operation is open', () => {
        for (const op of ['pay', 'deposit', 'withdraw'] as const) {
            expect(isVerifiedForCountry(fullTier, 'br', op)).toBe(true)
        }
    })

    it('a rail with no per-operation split answers every operation with its status', () => {
        const arRail: RailCapability = {
            ...pixRail(undefined),
            id: 'manteca.bank_transfer_ar',
            country: 'AR',
            currency: 'ARS',
        }
        expect(isVerifiedForCountry([arRail], 'AR', 'withdraw')).toBe(true)
        expect(isVerifiedForCountry([{ ...arRail, status: 'pending' }], 'AR', 'withdraw')).toBe(false)
    })

    it("another country's rail never answers for this one", () => {
        expect(isVerifiedForCountry(fullTier, 'AR', 'withdraw')).toBe(false)
    })
})
