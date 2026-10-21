import type { StarLpFxRate } from '@/components/Marketing/StarLp/starLp.types'
import {
    formatUsdArsRate,
    qrArgentinaRateAt,
    qrArgentinaRateCountFrom,
    qrArgentinaRateHeadline,
} from '../qrArgentinaRate.utils'

const usdArs: StarLpFxRate = {
    from: 'USD',
    to: 'ARS',
    rate: 1596.75,
    source: 'manteca',
    fetchedAt: '2026-10-21T10:00:00.000Z',
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

describe('qrArgentinaRateHeadline', () => {
    it('returns null without a live rate, so the fold shows its fallback title', () => {
        expect(qrArgentinaRateHeadline(null)).toBeNull()
    })

    it('carries the live rate, its printed value and a size that fits it to the column', () => {
        expect(qrArgentinaRateHeadline(usdArs)).toEqual({ rate: 1596.75, value: '1,596.75', fontSize: '20.75cqw' })
    })

    it('sets a longer number smaller', () => {
        const headline = qrArgentinaRateHeadline({ ...usdArs, rate: 12345.6 })
        expect(headline?.value).toBe('12,345.60')
        expect(headline?.fontSize).toBe('18.44cqw')
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
