import { starLpFxQuoteAgeMs, starLpFxReading } from '@/components/Marketing/StarLp/starLpFx.utils'
import type { StarLpFxRate } from '@/components/Marketing/StarLp/starLp.types'

const quote: StarLpFxRate = {
    from: 'USD',
    to: 'ARS',
    rate: 1601.88,
    source: 'manteca',
    fetchedAt: '2026-10-21T10:00:30.000Z',
    effectiveAt: '2026-10-21T10:00:00.000Z',
}

const at = (iso: string) => Date.parse(iso)

describe('starLpFxQuoteAgeMs', () => {
    it('measures from the older backend stamp', () => {
        expect(starLpFxQuoteAgeMs(quote, at('2026-10-21T10:01:00.000Z'))).toBe(60_000)
        const effectiveLater = { ...quote, effectiveAt: '2026-10-21T10:00:45.000Z' }
        expect(starLpFxQuoteAgeMs(effectiveLater, at('2026-10-21T10:01:00.000Z'))).toBe(30_000)
    })
})

describe('starLpFxReading', () => {
    it.each([
        ['just read', '2026-10-21T10:00:31.000Z', 'live'],
        ['exactly 30 minutes old', '2026-10-21T10:30:00.000Z', 'live'],
        ['a moment past 30 minutes', '2026-10-21T10:30:00.001Z', 'lastKnown'],
        ['6 hours old', '2026-10-21T16:00:00.000Z', 'lastKnown'],
        ['exactly 12 hours old', '2026-10-21T22:00:00.000Z', 'lastKnown'],
        ['a moment past 12 hours', '2026-10-21T22:00:00.001Z', 'none'],
        ['two days old', '2026-10-23T10:00:00.000Z', 'none'],
    ])('a quote %s is %s', (_label, now, tier) => {
        expect(starLpFxReading(quote, at(now)).tier).toBe(tier)
    })

    it('keys the tiers on effectiveAt even when generatedAt is fresh', () => {
        const oldObservation = { ...quote, effectiveAt: '2026-10-21T09:00:00.000Z' }
        expect(starLpFxReading(oldObservation, at('2026-10-21T10:00:31.000Z')).tier).toBe('lastKnown')
    })

    it('carries the quote in the live and last-known tiers, none in the none tier', () => {
        expect(starLpFxReading(quote, at('2026-10-21T10:05:00.000Z'))).toEqual({ tier: 'live', quote })
        expect(starLpFxReading(quote, at('2026-10-21T15:00:00.000Z'))).toEqual({ tier: 'lastKnown', quote })
        expect(starLpFxReading(quote, at('2026-10-22T10:00:00.000Z'))).toEqual({ tier: 'none', quote: null })
    })

    it('is none without a quote, or with an unreadable stamp', () => {
        expect(starLpFxReading(null, at('2026-10-21T10:00:00.000Z'))).toEqual({ tier: 'none', quote: null })
        expect(starLpFxReading({ ...quote, effectiveAt: 'x' }, at('2026-10-21T10:00:31.000Z')).tier).toBe('none')
    })
})
