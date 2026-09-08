import {
    getBankRegionIntent,
    getRegionIntent,
    pendingBankRailRegionPaths,
    providerForRegionIntent,
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

// Mirrors the BE registry (crossRegionProvider in peanut-api-ts
// src/kyc/level-registry.ts) — if these expectations change, the BE
// registry changed and both sides must move together.
describe('getBankRegionIntent', () => {
    // Mexico is a `latam` picker region but deposits/withdraws over Bridge SPEI —
    // LATAM + MX hits the Manteca path, which rejects MX (TASK-22333)
    it('routes Mexico bank flows as NA (Bridge), not LATAM', () => {
        expect(getBankRegionIntent({ id: 'MX', region: 'latam' })).toBe('NA')
    })

    it('falls back to the region intent for every other country', () => {
        expect(getBankRegionIntent({ id: 'AR', region: 'latam' })).toBe('LATAM')
        expect(getBankRegionIntent({ id: 'BR', region: 'latam' })).toBe('LATAM')
        expect(getBankRegionIntent({ id: 'CO', region: 'latam' })).toBe('LATAM')
        expect(getBankRegionIntent({ id: 'GB', region: 'europe' })).toBe('EU')
        expect(getBankRegionIntent({ id: 'US', region: 'north-america' })).toBe('NA')
        expect(getBankRegionIntent({ id: 'DE', region: 'europe' })).toBe('EU')
        expect(getBankRegionIntent({ id: 'NG', region: 'rest-of-the-world' })).toBe('ROW')
        expect(getBankRegionIntent({ id: 'XX' })).toBe('ROW')
        expect(getBankRegionIntent(undefined)).toBe('ROW')
    })
})

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
