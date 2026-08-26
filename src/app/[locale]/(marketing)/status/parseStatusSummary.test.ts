import { parseStatusSummary } from './types'

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
