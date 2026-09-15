import test from 'node:test'
import assert from 'node:assert/strict'
import { selectCaptureArtifact, selectCapturePair, selectCapturePairs } from './capture-artifacts.mjs'

test('selects the newest valid artifact for one side', () => {
    assert.deepEqual(
        selectCaptureArtifact(
            ['screen-library-after-1', 'screen-library-after-2', 'screen-library-after-3'],
            'after',
            (name) => !name.endsWith('-3')
        ),
        { attempt: 2, name: 'incoming/screen-library-after-2' }
    )
})

test('selects the newest complete capture pair and ignores unrelated artifacts', () => {
    const selected = selectCapturePair([
        'other-2',
        'screen-library-before-1',
        'screen-library-after-1',
        'screen-library-before-2',
        'screen-library-after-2',
        'screen-library-before-3',
        'screen-library-after-4',
    ])
    assert.deepEqual(selected, {
        attempt: 2,
        before: 'incoming/screen-library-before-2',
        after: 'incoming/screen-library-after-2',
    })
})

test('publisher-only retry can select the earlier capture pair', () => {
    assert.equal(
        selectCapturePair(['screen-library-before-1', 'screen-library-after-1', 'screen-library-before-2'], (pair) =>
            pair.before.endsWith('-1')
        ).attempt,
        1
    )
    assert.throws(() => selectCapturePair(['screen-library-before-1', 'screen-library-after-2']), /No complete/)
})

test('selects one complete pair for every locale', () => {
    assert.deepEqual(
        selectCapturePairs([
            'screen-library-before-en-1',
            'screen-library-after-en-1',
            'screen-library-before-es-419-1',
            'screen-library-after-es-419-1',
            'screen-library-before-es-AR-1',
            'screen-library-after-es-AR-1',
            'screen-library-before-pt-BR-1',
            'screen-library-after-pt-BR-1',
        ]),
        [
            {
                locale: 'en',
                attempt: 1,
                before: 'incoming/screen-library-before-en-1',
                after: 'incoming/screen-library-after-en-1',
            },
            {
                locale: 'es-419',
                attempt: 1,
                before: 'incoming/screen-library-before-es-419-1',
                after: 'incoming/screen-library-after-es-419-1',
            },
            {
                locale: 'es-AR',
                attempt: 1,
                before: 'incoming/screen-library-before-es-AR-1',
                after: 'incoming/screen-library-after-es-AR-1',
            },
            {
                locale: 'pt-BR',
                attempt: 1,
                before: 'incoming/screen-library-before-pt-BR-1',
                after: 'incoming/screen-library-after-pt-BR-1',
            },
        ]
    )
})
