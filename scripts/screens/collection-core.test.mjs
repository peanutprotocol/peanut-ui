import test from 'node:test'
import assert from 'node:assert/strict'
import {
    collectionId,
    composeCollection,
    missingByLocale,
    normalizeCollectionSpec,
    validateCollection,
} from './collection-core.mjs'

const sha = 'a'.repeat(40)
const image = 'b'.repeat(64) + '.webp'
const report = (locale, screens) => ({ schema: 1, type: 'capture', locale, commit: sha, screens })

test('collection specs preserve requested order, notes and locales', () => {
    assert.deepEqual(
        normalizeCollectionSpec({
            title: 'Choice overload',
            locales: ['en', 'pt-BR', 'en'],
            items: [{ id: 'profile', note: 'Flat menu' }, { id: 'send' }],
        }),
        {
            title: 'Choice overload',
            locales: ['en', 'pt-BR'],
            items: [{ id: 'profile', note: 'Flat menu' }, { id: 'send' }],
            captureMissing: false,
        }
    )
    assert.match(
        collectionId('Choice overload', new Date('2026-09-16T00:00:00Z'), 'abc123'),
        /^choice-overload-20260916-abc123$/
    )
})

test('collections reuse captured assets and identify only missing locale variants', () => {
    const collection = composeCollection({
        id: 'choice-overload-20260916-abc123',
        spec: {
            title: 'Choice overload',
            description: 'Screens with competing calls to action.',
            locales: ['en', 'pt-BR'],
            items: [{ id: 'profile', note: 'Flat menu' }, { id: 'send' }],
        },
        reports: {
            en: report('en', [
                { id: 'profile', name: 'Profile', flow: 'Profile', kind: 'route', status: 'captured', image },
                { id: 'send', name: 'Send', flow: 'Payments', kind: 'route', status: 'captured', image },
            ]),
            'pt-BR': report('pt-BR', [
                { id: 'profile', name: 'Profile', flow: 'Profile', kind: 'route', status: 'captured', image },
                { id: 'send', name: 'Send', flow: 'Payments', kind: 'route', status: 'unavailable', reason: 'Timeout' },
            ]),
        },
        createdAt: '2026-09-16T12:00:00Z',
        createdBy: 'reviewer@peanut.me',
    })
    assert.equal(collection.complete, false)
    assert.deepEqual(
        collection.items.map(({ id, order }) => ({ id, order })),
        [
            { id: 'profile', order: 0 },
            { id: 'send', order: 1 },
        ]
    )
    assert.equal(collection.items[0].variants.en.image, image)
    assert.deepEqual(missingByLocale(collection), { 'pt-BR': ['send'] })
    assert.deepEqual(validateCollection(collection).missing, [{ id: 'send', locale: 'pt-BR' }])
})

test('collection specs reject duplicate and unsafe screen IDs', () => {
    assert.throws(() => normalizeCollectionSpec({ title: 'x', items: [{ id: '../secret' }] }), /Invalid/)
    assert.throws(() => normalizeCollectionSpec({ title: 'x', items: [{ id: 'home' }, { id: 'home' }] }), /duplicate/)
})
