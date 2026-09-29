import assert from 'node:assert/strict'
import test from 'node:test'
import {
    BASELINE_LOCALES,
    ADDITIONAL_PROFILES,
    baselineArtifactName,
    verifyBaselineMatrix,
} from './baseline-viewports.mjs'

const sha = 'a'.repeat(40)
const manifest = (locale, profile) => {
    const [width, height] = profile.split('x').map(Number)
    return {
        schema: 1,
        type: 'capture',
        commit: sha,
        contentCommit: sha,
        harness: 'b'.repeat(64),
        fixtures: 'c'.repeat(64),
        locale,
        environment: 'test',
        adapter: 'test',
        capturedAt: '2026-09-21T00:00:00Z',
        profile: `${locale}-${profile}`,
        width,
        height,
        screens: [{ id: 'home', name: 'Home', flow: 'Home', kind: 'route', status: 'excluded', reason: 'test' }],
        inventory: [{ route: '/home', status: 'catalogued', screens: ['home'] }],
    }
}
const matrix = () => {
    const captures = new Map()
    for (const locale of BASELINE_LOCALES)
        for (const profile of ['393x852', ...ADDITIONAL_PROFILES])
            captures.set(baselineArtifactName(sha, locale, profile, 2), manifest(locale, profile))
    return captures
}
test('publisher requires exactly four locales by four viewport profiles at one immutable dev SHA', () => {
    const captures = matrix()
    const artifacts = [...captures.keys()].map((name) => ({ name, expired: false }))
    const result = verifyBaselineMatrix({ sha, attempt: 2, artifacts, readCapture: (name) => captures.get(name) })
    assert.equal(result.length, 16)
    assert.equal(result.filter((item) => item.profile !== '393x852').length, 12)
    assert.equal(result.find((item) => item.locale === 'es-AR' && item.profile === '320x712').slug, 'es-ar')
    assert.equal(baselineArtifactName(sha, 'en', '393x852', 2), `screen-library-baseline-${sha}-en-2`)
    assert.throws(
        () =>
            verifyBaselineMatrix({
                sha,
                attempt: 2,
                artifacts: artifacts.slice(1),
                readCapture: (name) => captures.get(name),
            }),
        /Re-run all jobs to create the full matrix under one run attempt/
    )
    captures.get(baselineArtifactName(sha, 'en', '440x956', 2)).commit = 'd'.repeat(40)
    assert.throws(
        () => verifyBaselineMatrix({ sha, attempt: 2, artifacts, readCapture: (name) => captures.get(name) }),
        /identity mismatch/
    )
})
