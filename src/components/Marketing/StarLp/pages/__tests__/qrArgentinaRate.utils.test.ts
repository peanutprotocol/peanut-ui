import type { StarLpFxRate } from '@/components/Marketing/StarLp/starLp.types'
import {
    formatUsdArsRate,
    qrArgentinaRateAt,
    qrArgentinaRateCountFrom,
    qrArgentinaRateHeadline,
    roundUsdArsRate,
} from '../qrArgentinaRate.utils'

const usdArs: StarLpFxRate = {
    from: 'USD',
    to: 'ARS',
    rate: 1596.75,
    source: 'manteca',
    fetchedAt: '2026-10-21T10:00:00.000Z',
    effectiveAt: '2026-10-21T09:59:59.000Z',
}

describe('formatUsdArsRate', () => {
    it('groups thousands and keeps two decimals', () => {
        expect(formatUsdArsRate(1596.75)).toBe('1,596.75')
        expect(formatUsdArsRate(1596.7)).toBe('1,596.70')
        expect(formatUsdArsRate(1600)).toBe('1,600.00')
    })

    it('rounds to the cent', () => {
        expect(formatUsdArsRate(1596.756)).toBe('1,596.76')
    })
})

describe('roundUsdArsRate', () => {
    it('rounds to the nearest 10 ARS', () => {
        expect(roundUsdArsRate(1601.88)).toBe(1600)
        expect(roundUsdArsRate(1596.75)).toBe(1600)
        expect(roundUsdArsRate(1594.99)).toBe(1590)
        expect(roundUsdArsRate(1605)).toBe(1610)
    })
})

describe('qrArgentinaRateHeadline', () => {
    it('returns null in the none tier, so the fold says "Best rate"', () => {
        expect(qrArgentinaRateHeadline({ tier: 'none', quote: null })).toBeNull()
    })

    it('prints a live rate exactly, after "$1 =", and counts it up', () => {
        expect(qrArgentinaRateHeadline({ tier: 'live', quote: usdArs })).toEqual({
            lead: '$1 =',
            rate: 1596.75,
            value: '1,596.75',
            label: '$1 = 1,596.75 ARS',
            fontSize: '14.16cqw',
            countsUp: true,
        })
    })

    it('prints a last-known rate rounded to the nearest 10, after "$1 ≈", at rest', () => {
        expect(qrArgentinaRateHeadline({ tier: 'lastKnown', quote: usdArs })).toEqual({
            lead: '$1 ≈',
            rate: 1600,
            value: '1,600',
            label: '$1 is about 1,600 ARS',
            fontSize: '20.58cqw',
            countsUp: false,
        })
    })

    it('sets a longer number smaller', () => {
        const headline = qrArgentinaRateHeadline({ tier: 'live', quote: { ...usdArs, rate: 12345.6 } })
        expect(headline?.value).toBe('12,345.60')
        expect(headline?.fontSize).toBe('12.62cqw')
    })
})

describe('qrArgentinaRateCountFrom', () => {
    it('starts at the power of ten below the rate, so the digit count never changes', () => {
        expect(qrArgentinaRateCountFrom(1596.75)).toBe(1000)
        expect(qrArgentinaRateCountFrom(999.5)).toBe(100)
        expect(qrArgentinaRateCountFrom(12345.6)).toBe(10000)
        expect(formatUsdArsRate(qrArgentinaRateCountFrom(1596.75)).length).toBe(formatUsdArsRate(1596.75).length)
    })
})

describe('qrArgentinaRateAt', () => {
    it('starts at from and lands exactly on the live rate', () => {
        expect(qrArgentinaRateAt(1000, 1596.75, 0)).toBe(1000)
        expect(qrArgentinaRateAt(1000, 1596.75, 1)).toBe(1596.75)
    })

    it('eases out: past halfway at the midpoint', () => {
        expect(qrArgentinaRateAt(1000, 2000, 0.5)).toBe(1875)
    })

    it('clamps progress outside 0–1', () => {
        expect(qrArgentinaRateAt(1000, 1596.75, -0.2)).toBe(1000)
        expect(qrArgentinaRateAt(1000, 1596.75, 1.4)).toBe(1596.75)
    })
})
