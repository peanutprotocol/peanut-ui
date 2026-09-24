import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { PNG } from 'pngjs'
import {
    validateCapture,
    validateJourneys,
    compare,
    storeAsset,
    verifyAsset,
    reviewRefs,
    mergeRefs,
    materializeCatalogue,
} from './core.mjs'
const dir = mkdtempSync(join(tmpdir(), 'screen-tests-'))
const png = (fill) => {
    const p = new PNG({ width: 393, height: 852 })
    p.data.fill(fill)
    return PNG.sync.write(p)
}
const a = storeAsset(dir, png(0)),
    b = storeAsset(dir, png(255))
const capture = (screens) => ({
    schema: 1,
    type: 'capture',
    commit: 'a'.repeat(40),
    contentCommit: 'b'.repeat(40),
    harness: 'c'.repeat(64),
    fixtures: 'd'.repeat(64),
    environment: 'test',
    publicBase: 'https://staging.peanut.me',
    adapter: 'v1',
    capturedAt: '2026-09-10T00:00:00Z',
    profile: 'en-393x852',
    width: 393,
    height: 852,
    screens,
    inventory: [{ route: '/home', status: 'catalogued', screens: screens.map((s) => s.id) }],
})
const screen = (id, image = a) => ({
    id,
    name: id,
    flow: 'Home',
    kind: 'route',
    status: 'captured',
    image,
    thumbnail: image,
})
const iphoneDevice = {
    platform: 'ios',
    label: 'iPhone',
    cutout: 'dynamic-island',
    safeArea: { top: 59, right: 0, bottom: 34, left: 0 },
}
test('capture device metadata is canonical and part of comparison identity', () => {
    const withDevice = { ...capture([screen('home')]), device: iphoneDevice }
    assert.deepEqual(validateCapture(withDevice).device, iphoneDevice)
    assert.throws(
        () =>
            validateCapture({
                ...withDevice,
                device: { ...iphoneDevice, safeArea: { ...iphoneDevice.safeArea, top: 0 } },
            }),
        /Unsupported capture device/
    )
    assert.throws(() => compare(capture([screen('home')]), withDevice, dir), /environments differ/)
})
test('same pixels remain unchanged; changed pixels get a diff', () => {
    const r = compare(capture([screen('home')]), capture([screen('home', b)]), dir)
    assert.equal(r.screens[0].status, 'changed')
    assert.ok(r.screens[0].diff)
    assert.equal(compare(capture([screen('home')]), capture([screen('home')]), dir).screens[0].status, 'unchanged')
})
test('capture metadata preserves journey order and comparisons use it instead of screen IDs', () => {
    const later = { ...screen('alpha'), order: 20, journey: 'Account setup' }
    const earlier = { ...screen('zeta'), order: 10, journey: 'Account setup' }
    const validated = validateCapture(capture([later, earlier]))
    assert.equal(validated.screens[0].journey, 'Account setup')
    assert.equal(validated.screens[0].order, 20)
    assert.deepEqual(
        compare(capture([later, earlier]), capture([later, earlier]), dir).screens.map(({ id }) => id),
        ['zeta', 'alpha']
    )
})
test('failure cannot become a removed or unchanged screen', () => {
    const failed = { id: 'home', name: 'Home', flow: 'Home', kind: 'route', status: 'failed', reason: 'Wrong route' }
    const r = compare(capture([screen('home')]), capture([failed]), dir)
    assert.equal(r.screens[0].status, 'failed')
    assert.equal(r.complete, false)
})
test('historical unsupported state is unavailable, not new', () => {
    const old = { ...screen('home'), status: 'unavailable', reason: 'Adapter unavailable' }
    assert.equal(compare(capture([old]), capture([screen('home')]), dir).screens[0].status, 'unavailable')
})
test('intentional exclusions and absent routes remain distinguishable from failures', () => {
    const excluded = { ...screen('excluded'), status: 'excluded', reason: 'Alias covered elsewhere' }
    const absent = { ...screen('absent'), status: 'absent', reason: 'Route does not exist' }
    const r = compare(capture([excluded, absent]), capture([excluded, absent]), dir)
    assert.deepEqual(
        r.screens.map((s) => s.status),
        ['absent', 'excluded']
    )
})
test('only complete catalogues prove additions and removals', () => {
    const r = compare(capture([screen('old')]), capture([screen('new')]), dir)
    assert.deepEqual(
        r.screens.map((s) => s.status),
        ['added', 'removed']
    )
})
test('different harness, fixtures or environment requires recapture', () => {
    for (const key of ['harness', 'fixtures', 'environment', 'adapter', 'publicBase']) {
        const r = capture([screen('home')])
        r[key] = key === 'harness' || key === 'fixtures' ? 'e'.repeat(64) : 'other'
        assert.throws(() => compare(capture([screen('home')]), r, dir), /environments differ/)
    }
})
test('captures from different locales cannot be compared', () => {
    const portuguese = { ...capture([screen('home')]), locale: 'pt-BR', profile: 'pt-BR-393x852' }
    assert.throws(() => compare(capture([screen('home')]), portuguese, dir), /environments differ/)
})
test('reject empty, duplicate, path traversal, and forged completion', () => {
    assert.throws(() => validateCapture(capture([])))
    assert.throws(() => validateCapture(capture([screen('home'), screen('home')])))
    assert.throws(() => validateCapture(capture([screen('../escape')])))
    assert.throws(() => validateCapture(capture([{ ...screen('home'), image: '../../secret' }])))
    assert.throws(() => validateCapture({ ...capture([screen('home')]), locale: 'fr', profile: 'fr-393x852' }))
    assert.throws(() => validateCapture({ ...capture([screen('home')]), width: 440 }))
    assert.throws(() =>
        validateCapture({ ...capture([screen('home')]), profile: 'en-999x999', width: 999, height: 999 })
    )
    assert.equal(
        validateCapture({ ...capture([{ ...screen('home'), status: 'failed', reason: 'timeout' }]), complete: true })
            .complete,
        false
    )
})
test('accepts each additional baseline profile only when its name and dimensions agree', () => {
    for (const [width, height] of [
        [440, 956],
        [360, 800],
        [320, 712],
    ]) {
        const input = { ...capture([screen('home')]), profile: `en-${width}x${height}`, width, height }
        assert.equal(validateCapture(input).profile, input.profile)
        assert.throws(() => validateCapture({ ...input, height: height + 1 }), /Unsupported capture profile/)
    }
})
test('asset digest and dimensions are checked before decoding', () => {
    const name = '0'.repeat(64) + '.png'
    writeFileSync(join(dir, name), 'not png')
    assert.throws(() => verifyAsset(dir, name), /integrity/)
    const p = new PNG({ width: 2, height: 2 })
    const tiny = storeAsset(dir, PNG.sync.write(p))
    assert.throws(() => verifyAsset(dir, tiny), /dimensions/)
    const journey = new PNG({ width: 1170, height: 1992 })
    const journeyName = storeAsset(dir, PNG.sync.write(journey))
    assert.doesNotThrow(() => verifyAsset(dir, journeyName, { variableDimensions: true }))
})

test('Nutcracker journeys retain only allowlisted public metadata', () => {
    const input = {
        schema: 1,
        type: 'journeys',
        source: 'nutcracker',
        commit: 'a'.repeat(40),
        uiCommit: 'b'.repeat(40),
        apiCommit: 'c'.repeat(40),
        locale: 'en',
        environment: 'sandbox',
        capturedAt: '2026-09-14T00:00:00Z',
        profile: 'en-iphone-14',
        width: 390,
        height: 664,
        attemptedSteps: 1,
        failedSteps: 0,
        omittedFailedSteps: 0,
        complete: true,
        replaySecret: 'do-not-publish',
        screens: [
            {
                id: 'send-success',
                name: 'Send success',
                flow: 'e2e-send',
                route: '/send/success',
                kind: 'route',
                status: 'passed',
                trustTier: 'full-e2e',
                image: a,
                thumbnail: b.replace(/\.png$/, '.webp'),
                trace: { authorization: 'secret' },
            },
        ],
    }
    const output = validateJourneys(input)
    assert.equal(output.complete, true)
    assert.equal(output.replaySecret, undefined)
    assert.equal(output.screens[0].trace, undefined)
    assert.equal(output.screens[0].route, '/send/success')
    assert.equal(output.screens[0].trustTier, 'full-e2e')
    assert.equal(output.attemptedSteps, 1)
    assert.equal(output.failedSteps, 0)
    assert.equal(output.omittedFailedSteps, 0)
    assert.equal(
        validateJourneys({
            ...input,
            complete: true,
            failedSteps: 1,
            screens: [{ ...input.screens[0], status: 'failed' }],
        }).complete,
        false
    )
    assert.equal(
        validateJourneys({
            ...input,
            complete: true,
            attemptedSteps: 2,
            failedSteps: 1,
            omittedFailedSteps: 1,
        }).complete,
        false
    )
    assert.throws(
        () =>
            validateJourneys({
                ...input,
                screens: [{ ...input.screens[0], route: '/claim#p=do-not-publish' }],
            }),
        /Invalid journey route/
    )
    assert.throws(
        () =>
            validateJourneys({
                ...input,
                screens: [{ ...input.screens[0], thumbnail: a }],
            }),
        /Invalid journey image/
    )
    assert.throws(() => validateJourneys({ ...input, attemptedSteps: undefined }), /Invalid journey run counts/)
    assert.throws(
        () =>
            validateJourneys({
                ...input,
                screens: [{ ...input.screens[0], trustTier: 'surface-only' }],
            }),
        /Invalid journey trust tier/
    )
})
test('exact review merge-base and first-parent resolution', () => {
    const head = 'a'.repeat(40),
        base = 'b'.repeat(40),
        common = 'c'.repeat(40)
    assert.deepEqual(
        reviewRefs(base, head, (args) => {
            assert.deepEqual(args, ['merge-base', base, head])
            return common
        }),
        { before: common, after: head }
    )
    assert.deepEqual(
        mergeRefs(head, (args) => {
            assert.deepEqual(args, ['rev-parse', head + '^1'])
            return base
        }),
        { before: base, after: head }
    )
    assert.throws(() => mergeRefs('dev', () => ''))
})
test.after(() => rmSync(dir, { recursive: true, force: true }))

test('published metadata drops unknown executable fields', () => {
    const r = validateCapture({
        ...capture([{ ...screen('home'), script: 'evil', url: 'https://evil.example' }]),
        html: '<script>evil</script>',
    })
    assert.equal(r.html, undefined)
    assert.equal(r.screens[0].url, undefined)
    assert.equal(r.screens[0].script, undefined)
})

test('interrupted capture retains pending catalogue entries and stays incomplete', () => {
    const all = materializeCatalogue([screen('home'), screen('card')], [screen('home')])
    assert.equal(all[1].status, 'unavailable')
    assert.equal(validateCapture(capture(all)).complete, false)
})

test('source-proven absent routes classify actual screen additions and removals', () => {
    const absent = { ...screen('new-route'), status: 'absent', reason: 'Route is absent in source' }
    assert.equal(
        compare(capture([screen('home'), absent]), capture([screen('home'), screen('new-route')]), dir).screens.find(
            (s) => s.id === 'new-route'
        ).status,
        'added'
    )
    assert.equal(
        compare(capture([screen('home'), screen('new-route')]), capture([screen('home'), absent]), dir).screens.find(
            (s) => s.id === 'new-route'
        ).status,
        'removed'
    )
})

test('missing route coverage cannot be marked complete', () => {
    const input = capture([screen('home')])
    input.inventory = [{ route: '/new', status: 'missing', reason: 'Needs scenario' }]
    assert.equal(validateCapture(input).complete, false)
    delete input.inventory
    assert.equal(validateCapture(input).complete, false)
})

test('a forged inventory cannot hide missing scenario coverage', () => {
    const input = capture([screen('home')])
    input.inventory = [{ route: '/new', status: 'catalogued', screens: ['missing'] }]
    assert.throws(() => validateCapture(input), /missing screens/)
    input.inventory = [{ route: '/new', status: 'excluded' }]
    assert.throws(() => validateCapture(input), /reason/)
})
