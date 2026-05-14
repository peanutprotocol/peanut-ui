import { daysUntilExpiry, shouldShowAutoRenewBanner } from '@/components/Card/cardExpiry.utils'

describe('daysUntilExpiry', () => {
    it('returns positive days for future expiry', () => {
        const now = new Date('2026-04-16T00:00:00Z')
        expect(daysUntilExpiry(6, 2026, now)).toBeGreaterThan(0)
    })

    it('returns negative days for past expiry', () => {
        const now = new Date('2026-04-16T00:00:00Z')
        expect(daysUntilExpiry(1, 2026, now)).toBeLessThan(0)
    })
})

describe('shouldShowAutoRenewBanner', () => {
    it('shows banner when expiring within 14 days', () => {
        const now = new Date('2026-04-20T00:00:00Z')
        expect(shouldShowAutoRenewBanner(4, 2026, now)).toBe(true)
    })

    it('hides banner when expiring far in the future', () => {
        const now = new Date('2026-04-16T00:00:00Z')
        expect(shouldShowAutoRenewBanner(12, 2028, now)).toBe(false)
    })

    it('hides banner after expiry', () => {
        const now = new Date('2026-05-01T00:00:00Z')
        expect(shouldShowAutoRenewBanner(1, 2026, now)).toBe(false)
    })
})
