import { MAX_CLOCK_SKEW_MS, MAX_SUMMARY_AGE_MS, isFresh, parseStatusSummary, type StatusSummary } from './types'

const validBucket = { hourStart: '2026-08-25T00:00:00.000Z', state: 'operational', checks: 12, failures: 0 }
const validProvider = { provider: 'rain', state: 'operational', uptimePct: 100, buckets: [validBucket], incidents: [] }
const valid = {
    generatedAt: '2026-08-25T00:00:00.000Z',
    windowHours: 72,
    state: 'operational',
    providers: [validProvider],
}

describe('parseStatusSummary', () => {
    it('accepts a well-formed feed', () => {
        expect(parseStatusSummary(valid)).toEqual(valid)
    })

    // Each of these used to reach StatusBoard and throw inside providers.map,
    // past the point where the page could still show its fallback.
    it.each([
        ['empty object', {}],
        ['null', null],
        ['a string', 'nope'],
        ['providers missing', { ...valid, providers: undefined }],
        ['providers not an array', { ...valid, providers: { rain: validProvider } }],
        ['a provider without buckets', { ...valid, providers: [{ ...validProvider, buckets: undefined }] }],
        // The page refuses a stale summary, so one that cannot say when it was
        // made is one it cannot check.
        ['no generatedAt', { ...valid, generatedAt: undefined }],
        [
            'an unknown bucket state',
            { ...valid, providers: [{ ...validProvider, buckets: [{ ...validBucket, state: 'exploded' }] }] },
        ],
        [
            'an unknown incident reason',
            {
                ...valid,
                providers: [
                    { ...validProvider, incidents: [{ id: 'i', startedAt: 'x', resolvedAt: null, reason: 'vibes' }] },
                ],
            },
        ],
    ])('rejects %s', (_label, payload) => {
        expect(parseStatusSummary(payload)).toBeNull()
    })
})

// A CDN handing back the last good body over a dead origin is what an outage
// looks like from the edge. Rendering that cached "all operational" is how a
// status page ends up green through its own downtime.
describe('isFresh', () => {
    const at = (iso: string) => ({ ...valid, generatedAt: iso }) as StatusSummary
    const now = Date.parse('2026-08-25T12:00:00.000Z')

    it('accepts a summary within the staleness budget', () => {
        expect(isFresh(at(new Date(now - MAX_SUMMARY_AGE_MS + 1000).toISOString()), now)).toBe(true)
    })

    it('rejects one that has outlived it', () => {
        expect(isFresh(at(new Date(now - MAX_SUMMARY_AGE_MS - 1000).toISOString()), now)).toBe(false)
    })

    it('rejects an unparseable timestamp rather than reading it as age zero', () => {
        expect(isFresh(at('whenever'), now)).toBe(false)
    })

    // Age is the only thing stopping a cached green board outliving the system
    // it describes, and a future stamp suspends it for as long as the clock is
    // wrong — an hour ahead would buy a dead backend seventy minutes of green.
    it('rejects a summary stamped further ahead than clock skew explains', () => {
        expect(isFresh(at(new Date(now + 60 * 60_000).toISOString()), now)).toBe(false)
    })

    it('tolerates a feed host running slightly ahead of us', () => {
        expect(isFresh(at(new Date(now + MAX_CLOCK_SKEW_MS - 1000).toISOString()), now)).toBe(true)
    })
})
