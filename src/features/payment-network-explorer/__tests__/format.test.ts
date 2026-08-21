import { formatCompactCount, formatUsd, formatUtc } from '../format'

describe('payment explorer formatting', () => {
    it('formats USD with cents below $1k and whole dollars above', () => {
        expect(formatUsd(12.5)).toBe('$12.50')
        expect(formatUsd(0)).toBe('$0.00')
        expect(formatUsd(1500)).toBe('$1,500')
        expect(formatUsd(1234567.89)).toBe('$1,234,568')
    })

    it('never renders a non-finite amount', () => {
        expect(formatUsd(Number.NaN)).toBe('—')
        expect(formatUsd(Number.POSITIVE_INFINITY)).toBe('—')
    })

    it('formats UTC timestamps and rejects invalid input', () => {
        expect(formatUtc('2026-08-06T12:00:00.000Z')).toContain('06 Aug 2026')
        expect(formatUtc('not-a-date')).toBe('—')
    })

    it('compacts large counts', () => {
        expect(formatCompactCount(12_400)).toBe('12.4K')
    })
})
