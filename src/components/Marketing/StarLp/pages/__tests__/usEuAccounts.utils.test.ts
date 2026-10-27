import type { StarLpFxRate } from '@/components/Marketing/StarLp/starLp.types'
import { usEuMoneyInBody } from '../usEuAccounts.utils'

const eurUsd = (rate: number): StarLpFxRate => ({
    from: 'EUR',
    to: 'USD',
    rate,
    source: 'bridge',
    fetchedAt: '2026-10-21T10:00:00.000Z',
    effectiveAt: '2026-10-21T09:59:59.000Z',
})

describe('usEuMoneyInBody', () => {
    it('states the dollars credited, floored to the cent, in the app push words', () => {
        // 1,500 × 1.156789 = 1,735.1835 → $1,735.18
        expect(usEuMoneyInBody(1500, eurUsd(1.156789))).toBe('$1,735.18 added from your bank.')
    })

    it('never prints a euro amount, and has no body without a live rate', () => {
        expect(usEuMoneyInBody(1500, null)).toBeNull()
        expect(usEuMoneyInBody(1500, eurUsd(0))).toBeNull()
    })
})
