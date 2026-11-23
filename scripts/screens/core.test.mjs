import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { PNG } from 'pngjs'
import { canReuseBaseline } from './baseline-reuse.mjs'
import { CAPTURE_PROFILES } from './capture-profiles.mjs'
import {
    publicationCapture,
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
test('default-screen classification is validated and carried into comparisons', () => {
    const before = capture([{ ...screen('home'), defaultScreen: true }])
    const after = capture([{ ...screen('home'), defaultScreen: false }])
    assert.equal(compare(before, after, dir).screens[0].defaultScreen, false)
    assert.throws(
        () => validateCapture(capture([{ ...screen('home'), defaultScreen: 'yes' }])),
        /default-screen classification/
    )
})
test('four-pixel rendering noise stays unchanged and the first visible percentage still changes', () => {
    for (const [profile, { width, height }] of Object.entries(CAPTURE_PROFILES)) {
        const image = new PNG({ width, height })
        image.data.fill(255)
        const original = storeAsset(dir, PNG.sync.write(image))
        const firstChangedPixelCount = Math.ceil(width * height * 0.00005)
        const profiledCapture = (imageName) => ({
            ...capture([screen('home', imageName)]),
            width,
            height,
            profile: `en-${profile}`,
        })
        for (const count of [4, firstChangedPixelCount - 1, firstChangedPixelCount]) {
            const noisy = PNG.sync.read(PNG.sync.write(image))
            // Isolated solid pixels avoid pixelmatch's anti-aliasing exclusions.
            for (let i = 0; i < count; i++) {
                const offset = (100 * width + 100 + i * 3) * 4
                noisy.data[offset] = noisy.data[offset + 1] = noisy.data[offset + 2] = 0
            }
            const changedImage = storeAsset(dir, PNG.sync.write(noisy))
            const row = compare(profiledCapture(original), profiledCapture(changedImage), dir).screens[0]
            assert.equal(row.pixels, count)
            assert.equal(row.percent, (count / (width * height)) * 100)
            assert.equal(row.status, count < firstChangedPixelCount ? 'unchanged' : 'changed')
            assert.equal(row.belowThreshold, count < firstChangedPixelCount ? true : undefined)
            assert.equal(Boolean(row.diff), count >= firstChangedPixelCount)
            if (row.status === 'changed') assert.notEqual(row.percent.toFixed(2), '0.00')
        }
    }
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
    assert.equal(r.screens[0].status, 'not-comparable')
    assert.equal(r.complete, false)
})
test('a state with an unavailable baseline retains the reason and cannot be compared', () => {
    const old = { ...screen('home'), status: 'unavailable', reason: 'Adapter unavailable' }
    const result = compare(capture([old]), capture([screen('home')]), dir)
    assert.equal(result.screens[0].status, 'not-comparable')
    assert.equal(result.screens[0].before.status, 'unavailable')
    assert.equal(result.screens[0].before.reason, 'Adapter unavailable')
    assert.equal(result.screens[0].after.image, a)
    assert.equal(result.screens[0].diff, undefined)
    assert.equal(result.complete, false)
    for (const status of ['failed', 'excluded']) {
        const gap = { ...old, status }
        assert.equal(compare(capture([gap]), capture([screen('home')]), dir).screens[0].status, 'not-comparable')
    }
    assert.equal(compare(capture([screen('home')]), capture([old]), dir).screens[0].status, 'not-comparable')
    assert.equal(
        compare(
            capture([screen('other'), { ...old, status: 'excluded' }]),
            capture([screen('other'), screen('home')]),
            dir
        ).complete,
        false
    )
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
test('catalogue membership identifies additions and removals', () => {
    const r = compare(capture([screen('old')]), capture([screen('new')]), dir)
    assert.deepEqual(
        r.screens.map((s) => s.status),
        ['new', 'removed']
    )
})
test('different harness, fixtures or environment requires recapture', () => {
    for (const key of ['harness', 'fixtures', 'environment', 'adapter', 'publicBase']) {
        const r = capture([screen('home')])
        r[key] = key === 'harness' || key === 'fixtures' ? 'e'.repeat(64) : 'other'
        assert.throws(() => compare(capture([screen('home')]), r, dir), /environments differ/)
    }
})
test('runner host kernel and Node patch do not split a comparison; the renderer does', () => {
    const runner = (host, node, chromium = '145.0.7632.6') =>
        `linux-x64-${host};node=${node};chromium=${chromium};dpr=1;locale=en;device=ios;browser=iPhone 15 Pro;safe-area=59,0,34,0;UTC;light;reduced-motion`
    const azure = { ...capture([screen('home')]), environment: runner('7.0.0-1017-azure', 'v22.23.4') }
    const aws = { ...capture([screen('home')]), environment: runner('7.0.0-1014-aws', 'v22.23.3') }
    assert.equal(compare(azure, aws, dir).screens[0].status, 'unchanged')
    for (const environment of [
        runner('7.0.0-1014-aws', 'v22.23.4', '146.0.7700.1'),
        runner('7.0.0-1014-aws', 'v22.23.4').replace('dpr=1', 'dpr=2'),
        runner('7.0.0-1014-aws', 'v22.23.4').replace('linux-x64', 'linux-arm64'),
        runner('7.0.0-1014-aws', 'v22.23.4').replace(';light', ';dark'),
    ])
        assert.throws(() => compare(azure, { ...aws, environment }, dir), /environments differ/)
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
    assert.throws(() => publicationCapture(capture(all)), /interrupted/)
    assert.throws(() => publicationCapture({ ...capture([screen('home')]), finished: false }), /interrupted/)
})

test('source-proven absent routes classify actual screen additions and removals', () => {
    const absent = { ...screen('new-route'), status: 'absent', reason: 'Route is absent in source' }
    assert.equal(
        compare(capture([screen('home'), absent]), capture([screen('home'), screen('new-route')]), dir).screens.find(
            (s) => s.id === 'new-route'
        ).status,
        'new'
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
test('flag overrides on a captured state survive validation; malformed ones are rejected', () => {
    const variant = { ...screen('home-flag-card-promotion-disabled-true'), flags: { 'card-promotion-disabled': true } }
    const experiment = { ...screen('settings-flag-switches'), flags: { 'signup-notification-switches': 'defaults_on' } }
    const valid = validateCapture(capture([screen('home'), variant, experiment]))
    assert.deepEqual(
        valid.screens.map((s) => s.flags),
        [undefined, { 'card-promotion-disabled': true }, { 'signup-notification-switches': 'defaults_on' }]
    )
    for (const flags of [{}, [], { 'Bad Key': true }, { flag: 3 }, { flag: '<script>' }])
        assert.throws(() => validateCapture(capture([{ ...screen('home'), flags }])), /Invalid flag overrides/)
})

test('visual evidence uses only counted pixels and distinguishes local movement from a second edit', () => {
    const image = new PNG({ width: 393, height: 852 })
    const frame = (offset, secondEdit = false, insideNoise = false) => {
        image.data.fill(255)
        for (let y = 80 + offset; y < 100 + offset; y++) {
            image.data.fill(0, (y * 393 + 60) * 4, (y * 393 + 90) * 4)
            for (let x = 60; x < 90; x++) image.data[(y * 393 + x) * 4 + 3] = 255
        }
        if (offset) image.data[(300 * 393 + 200) * 4] = secondEdit ? 0 : 254
        if (insideNoise) image.data[(95 * 393 + 65) * 4] = 1
        return capture([screen('home', storeAsset(dir, PNG.sync.write(image)))])
    }
    const before = frame(0)
    const moved = compare(before, frame(2), dir).screens[0]
    assert.equal(moved.status, 'changed')
    assert.equal(moved.pixels, 120)
    assert.deepEqual(moved.changeBounds, { x: 60, y: 80, width: 30, height: 22 })
    assert.deepEqual(moved.translation, { dx: 0, dy: 2 })
    assert.ok(moved.diff)

    const edited = compare(before, frame(2, true), dir).screens[0]
    assert.equal(edited.pixels, 121)
    assert.deepEqual(edited.changeBounds, { x: 60, y: 80, width: 141, height: 221 })
    assert.equal(edited.translation, undefined)
    assert.equal(compare(before, frame(2, false, true), dir).screens[0].translation, undefined)
    assert.equal(compare(before, frame(4), dir).screens[0].translation, undefined)
})

test('partial comparisons retain real captures and describe gaps without invented evidence', () => {
    const gap = (id, status = 'unavailable') => ({
        id,
        name: id,
        flow: 'Home',
        kind: 'route',
        status,
        reason: `${id} unavailable fixture`,
    })
    for (const gapStatus of ['unavailable', 'failed']) {
        const before = capture([
            screen('shared'),
            screen('removed'),
            screen('current-gap'),
            gap('baseline-gap', gapStatus),
            gap('both-gap', gapStatus),
        ])
        const after = capture([
            screen('shared'),
            screen('added'),
            gap('current-gap', gapStatus),
            screen('baseline-gap'),
            gap('both-gap', gapStatus),
        ])
        const result = compare(before, after, dir)
        const byID = new Map(result.screens.map((row) => [row.id, row]))
        assert.equal(byID.size, 6)
        assert.equal(byID.get('shared').status, 'unchanged')
        assert.equal(byID.get('added').status, 'new')
        assert.equal(byID.get('removed').status, 'removed')
        assert.equal(byID.get('baseline-gap').status, 'not-comparable')
        assert.equal(byID.get('current-gap').status, 'not-comparable')
        assert.equal(byID.get('both-gap').status, 'not-comparable')
        assert.equal(result.complete, false)
        for (const id of ['baseline-gap', 'both-gap']) {
            assert.equal(byID.get(id).before.reason, `${id} unavailable fixture`)
            assert.equal(byID.get(id).before.image, undefined)
        }
        for (const id of ['current-gap', 'both-gap']) {
            assert.equal(byID.get(id).after.reason, `${id} unavailable fixture`)
            assert.equal(byID.get(id).after.image, undefined)
        }
        assert.equal(byID.get('added').before?.image, undefined)
        assert.equal(byID.get('removed').after?.image, undefined)
        assert.equal(byID.get('added').after.image, a)
        assert.equal(byID.get('removed').before.image, a)
        for (const row of result.screens) assert.equal(row.diff, undefined)
    }
})

test('partial trusted baseline reuse accepts catalogue drift while enforcing identity', () => {
    const baselineSHA = 'a'.repeat(40)
    const gap = {
        id: 'unavailable',
        name: 'Unavailable',
        flow: 'Home',
        kind: 'route',
        status: 'unavailable',
        reason: 'Known unavailable fixture',
    }
    const before = capture([screen('shared'), screen('removed'), gap])
    const after = { ...capture([screen('shared'), screen('added')]), commit: 'e'.repeat(40) }
    assert.equal(canReuseBaseline(before, after, baselineSHA), true)
    assert.equal(canReuseBaseline(before, after, 'f'.repeat(40)), false)
    for (const field of ['harness', 'fixtures', 'environment', 'adapter', 'publicBase']) {
        const value = ['harness', 'fixtures'].includes(field) ? 'f'.repeat(64) : 'different'
        assert.equal(canReuseBaseline(before, { ...after, [field]: value }, baselineSHA), false, field)
    }
    assert.equal(canReuseBaseline(capture([gap]), after, baselineSHA), false)
})

test('a targeted review projects a state missing from the unscoped revision', () => {
    const head = { ...capture([screen('added')]), scope: { mode: 'targeted', screenIds: ['added'] } }
    const review = compare(capture([screen('old')]), head, dir)
    assert.deepEqual(
        review.screens.map(({ id, status }) => [id, status]),
        [['added', 'new']]
    )
    assert.equal(review.screens[0].before.image, undefined)
    assert.equal(review.screens[0].before.status, 'absent')
    assert.deepEqual(compare(review.before, review.after, dir).screens, review.screens)
})
