import type { StarLpFxRate } from '@/components/Marketing/StarLp/starLp.types'
import { qrArDinnerShareUsd } from '../qrArgentinaChat.utils'

const quote = (rate: number): StarLpFxRate => ({
    from: 'USD',
    to: 'ARS',
    rate,
    source: 'manteca',
    fetchedAt: '2026-10-21T10:00:00.000Z',
    effectiveAt: '2026-10-21T09:59:59.000Z',
})

describe('qrArDinnerShareUsd', () => {
    it('splits the ARS 120,000 bill six ways at the live rate, rounded up to the cent', () => {
        // 120,000 / 6 / 1,603.64 = 12.4716… → $12.48
        expect(qrArDinnerShareUsd({ tier: 'live', quote: quote(1603.64) })).toBe('$12.48')
    })

    it('takes a last-known rate as the fold prints it, rounded, and asks a whole dollar', () => {
        // 1,412.34 prints as ≈ 1,410; 20,000 / 1,410 = 14.18… → $15
        expect(qrArDinnerShareUsd({ tier: 'lastKnown', quote: quote(1412.34) })).toBe('$15')
    })

    it('has no figure when there is no rate', () => {
        expect(qrArDinnerShareUsd({ tier: 'none', quote: null })).toBeNull()
    })
})
