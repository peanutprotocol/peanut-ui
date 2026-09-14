import assert from 'node:assert/strict'
import test from 'node:test'
import { selectBaselineArtifacts } from './baseline-artifacts.mjs'

const sha = 'a'.repeat(40)

test('baseline selection ignores integration artifacts and binds the expected revision', () => {
    const result = selectBaselineArtifacts(
        [
            `screen-library-baseline-${sha}-en-2`,
            `screen-library-baseline-${sha}-es-419-2`,
            `screen-library-baseline-${sha}-es-AR-2`,
            `screen-library-baseline-${sha}-pt-BR-2`,
            'screen-library-after-en-9',
        ],
        'baseline',
        sha
    )
    assert.deepEqual(
        result.map(({ locale, name }) => ({ locale, name })),
        [
            { locale: 'en', name: `screen-library-baseline-${sha}-en-2` },
            { locale: 'es-419', name: `screen-library-baseline-${sha}-es-419-2` },
            { locale: 'es-AR', name: `screen-library-baseline-${sha}-es-AR-2` },
            { locale: 'pt-BR', name: `screen-library-baseline-${sha}-pt-BR-2` },
        ]
    )
})

test('integration baseline selection ignores before artifacts and prefers explicit English', () => {
    const result = selectBaselineArtifacts(
        [
            'screen-library-before-en-3',
            'screen-library-after-3',
            'screen-library-after-en-3',
            'screen-library-after-es-419-3',
            'screen-library-after-es-AR-3',
            'screen-library-after-pt-BR-3',
        ],
        'integration',
        sha
    )
    assert.deepEqual(
        result.map(({ locale, name }) => ({ locale, name })),
        [
            { locale: 'en', name: 'screen-library-after-en-3' },
            { locale: 'es-419', name: 'screen-library-after-es-419-3' },
            { locale: 'es-AR', name: 'screen-library-after-es-AR-3' },
            { locale: 'pt-BR', name: 'screen-library-after-pt-BR-3' },
        ]
    )
})

test('duplicate explicit artifacts are rejected', () => {
    assert.throws(
        () => selectBaselineArtifacts(['screen-library-after-en-3', 'screen-library-after-en-3'], 'integration', sha),
        /Ambiguous external baseline artifacts for locale en/
    )
})
