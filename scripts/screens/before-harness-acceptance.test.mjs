import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { PNG } from 'pngjs'

// These acceptance tests were authored from the accepted public contract only.
const BEFORE = 'a'.repeat(40)
const AFTER = 'b'.repeat(40)
const RECEIPT = { schema: 1, mode: 'base', harnessCommit: BEFORE }

function capture(commit, overrides = {}) {
    return {
        schema: 1,
        type: 'capture',
        commit,
        contentCommit: commit,
        harness: '1'.repeat(64),
        fixtures: '2'.repeat(64),
        environment: 'chromium-test-renderer',
        adapter: 'acceptance-adapter-v1',
        capturedAt: '2026-11-02T12:00:00.000Z',
        publicBase: 'https://staging.peanut.me',
        locale: 'en',
        profile: 'en-393x852',
        width: 393,
        height: 852,
        screens: [
            {
                id: 'home',
                name: 'Home',
                flow: 'Home',
                kind: 'route',
                status: 'captured',
                image: `${'a'.repeat(64)}.png`,
                thumbnail: `${'a'.repeat(64)}.png`,
            },
        ],
        inventory: [{ route: '/home', status: 'catalogued', screens: ['home'] }],
        ...overrides,
    }
}

function differentSyntheticCapture() {
    return capture(AFTER, {
        harness: '3'.repeat(64),
        fixtures: '4'.repeat(64),
        adapter: 'acceptance-adapter-v2',
    })
}

async function rejectedEnvironment(before, after, receipt) {
    const { sameEnvironment } = await import('./core.mjs')
    let result
    try {
        result = sameEnvironment(before, after, receipt)
    } catch {
        return
    }
    assert.equal(result, false)
}

test('head comparisons remain strict without a receipt', async () => {
    const { sameEnvironment } = await import('./core.mjs')
    assert.equal(sameEnvironment(capture(BEFORE), capture(AFTER)), true)
    await rejectedEnvironment(capture(BEFORE), differentSyntheticCapture())
})

test('matching base receipt allows all three synthetic identities to differ', async () => {
    const { sameEnvironment } = await import('./core.mjs')
    assert.equal(sameEnvironment(capture(BEFORE), differentSyntheticCapture(), RECEIPT), true)
})

const invalidReceipts = {
    null: null,
    string: 'base',
    array: [],
    empty: {},
    missingSchema: { mode: 'base', harnessCommit: BEFORE },
    wrongSchema: { ...RECEIPT, schema: 2 },
    stringSchema: { ...RECEIPT, schema: '1' },
    wrongMode: { ...RECEIPT, mode: 'head' },
    unknownMode: { ...RECEIPT, mode: 'anything' },
    missingCommit: { schema: 1, mode: 'base' },
    wrongCommit: { ...RECEIPT, harnessCommit: AFTER },
    abbreviatedCommit: { ...RECEIPT, harnessCommit: BEFORE.slice(0, 7) },
}

for (const [name, receipt] of Object.entries(invalidReceipts)) {
    test(`provided ${name} receipt rejects even otherwise identical environments`, async () => {
        await rejectedEnvironment(capture(BEFORE), capture(AFTER), receipt)
        await rejectedEnvironment(capture(BEFORE), differentSyntheticCapture(), receipt)
    })
}

for (const [field, value] of Object.entries({
    environment: 'different-renderer',
    profile: 'fr-393x852',
    locale: 'fr',
    publicBase: 'https://different.example',
    device: 'different-device',
    width: 394,
    height: 853,
})) {
    test(`base receipt never permits ${field} mismatch`, async () => {
        const before = capture(BEFORE, { device: 'same-device' })
        const after = { ...differentSyntheticCapture(), device: 'same-device', [field]: value }
        await rejectedEnvironment(before, after, RECEIPT)
    })
}

test('compare retains a canonical base receipt in the report', async () => {
    const { compare, storeAsset } = await import('./core.mjs')
    const dir = await mkdtemp(path.join(os.tmpdir(), 'before-harness-acceptance-'))
    try {
        const png = new PNG({ width: 393, height: 852 })
        for (let offset = 0; offset < png.data.length; offset += 4) {
            png.data.set([30, 60, 90, 255], offset)
        }
        const image = await storeAsset(dir, PNG.sync.write(png))
        const before = capture(BEFORE)
        const after = differentSyntheticCapture()
        for (const manifest of [before, after]) {
            manifest.screens[0].image = image
            manifest.screens[0].thumbnail = image
        }
        const report = await compare(before, after, dir, { ...RECEIPT, ignored: 'untrusted' })
        assert.deepEqual(report.beforeHarness, RECEIPT)
    } finally {
        await rm(dir, { recursive: true, force: true })
    }
})

test('head baseline reuse remains compatible and strict', async () => {
    const { canReuseBaseline } = await import('./baseline-reuse.mjs')
    assert.equal(canReuseBaseline(capture(BEFORE), capture(AFTER), BEFORE), true)
    assert.equal(canReuseBaseline(capture(BEFORE), differentSyntheticCapture(), BEFORE), false)
})

test('base baseline reuse requires both the receipt and authenticated source harness commit', async () => {
    const { canReuseBaseline } = await import('./baseline-reuse.mjs')
    const before = capture(BEFORE)
    const after = differentSyntheticCapture()
    assert.equal(canReuseBaseline(before, after, BEFORE, { beforeHarness: RECEIPT, sourceHarnessCommit: BEFORE }), true)
    for (const options of [
        { beforeHarness: RECEIPT },
        { beforeHarness: RECEIPT, sourceHarnessCommit: AFTER },
        { beforeHarness: RECEIPT, sourceHarnessCommit: BEFORE.slice(0, 7) },
        { sourceHarnessCommit: BEFORE },
    ]) {
        assert.equal(canReuseBaseline(before, after, BEFORE, options), false)
    }
    // Data inside the manifest is not authenticated source provenance.
    assert.equal(
        canReuseBaseline({ ...before, sourceHarnessCommit: BEFORE }, after, BEFORE, { beforeHarness: RECEIPT }),
        false
    )
})

test('screens the PR adds block head reuse but not base reuse', async () => {
    const { canReuseBaseline } = await import('./baseline-reuse.mjs')
    const added = {
        id: 'kyc-new',
        name: 'New KYC state',
        flow: 'Verification',
        kind: 'route',
        status: 'captured',
        image: `${'b'.repeat(64)}.png`,
        thumbnail: `${'b'.repeat(64)}.png`,
    }
    const extraScreen = (base) => ({ ...base, screens: [...base.screens, added] })
    assert.equal(canReuseBaseline(capture(BEFORE), extraScreen(capture(AFTER)), BEFORE), false)
    assert.equal(
        canReuseBaseline(capture(BEFORE), extraScreen(differentSyntheticCapture()), BEFORE, {
            beforeHarness: RECEIPT,
            sourceHarnessCommit: BEFORE,
        }),
        true
    )
})

test('base reuse preserves commit, renderer and completeness requirements', async () => {
    const { canReuseBaseline } = await import('./baseline-reuse.mjs')
    const options = { beforeHarness: RECEIPT, sourceHarnessCommit: BEFORE }
    const after = differentSyntheticCapture()
    for (const before of [
        capture(AFTER),
        capture(BEFORE, { environment: 'other-renderer' }),
        capture(BEFORE, {
            screens: [{ ...capture(BEFORE).screens[0], status: 'error', image: undefined, thumbnail: undefined }],
        }),
        capture(BEFORE, { screens: [], inventory: [] }),
        capture(BEFORE, { scope: { mode: 'targeted', screenIds: ['home'] } }),
    ]) {
        assert.equal(canReuseBaseline(before, after, BEFORE, options), false)
    }
})

function fixtureTree() {
    return {
        'src/dev/fixtures/index.ts': "import { value } from '../../utils/synthetic'; export const fixture = value;",
        'src/utils/synthetic.ts': "export { value } from './nested';",
        'src/utils/nested.ts': "export const value = 'before';",
        'src/utils/demo-api.ts': 'export const demoApi = {};',
        'src/constants/demo-data.ts': 'export const demoData = {};',
        'src/constants/residence.consts.ts': "export const residence = ['PT'];",
        'src/types/api.openapi.json': '{"openapi":"3.0.0"}',
        'scripts/screens/adapter.ts': "export const ADAPTER_VERSION = 'v1';",
        'scripts/screens/openapi-example.ts': 'export const example = {};',
        'scripts/screens/capture.ts': 'export const capture = 1;',
        'src/dev/screens/catalogue.ts': 'export const catalogue = [];',
    }
}

async function selection(beforeTree, afterTree) {
    const { selectBeforeHarness } = await import('./before-harness.mjs')
    const trees = { [BEFORE]: beforeTree, [AFTER]: afterTree }
    const runGit = (args) => {
        if (args[0] === 'ls-tree') {
            assert.deepEqual(args.slice(0, 4), ['ls-tree', '-r', '--name-only', '-z'])
            assert.ok(trees[args[4]], 'requested immutable tree exists')
            return Object.keys(trees[args[4]]).sort().join('\0') + '\0'
        }
        assert.equal(args[0], 'show')
        const separator = args[1].indexOf(':')
        const sha = args[1].slice(0, separator)
        const file = args[1].slice(separator + 1)
        assert.ok(trees[sha] && Object.hasOwn(trees[sha], file), `missing source ${file}`)
        return trees[sha][file]
    }
    return selectBeforeHarness({ before: BEFORE, after: AFTER, runGit })
}

test('unchanged immutable trees select head deterministically', async () => {
    assert.equal(await selection(fixtureTree(), fixtureTree()), 'head')
    assert.equal(await selection(fixtureTree(), fixtureTree()), 'head')
})

for (const file of [
    'src/dev/fixtures/index.ts',
    'src/utils/synthetic.ts',
    'src/utils/nested.ts',
    'src/utils/demo-api.ts',
    'src/constants/demo-data.ts',
    'src/constants/residence.consts.ts',
    'src/types/api.openapi.json',
    'scripts/screens/adapter.ts',
    'scripts/screens/openapi-example.ts',
]) {
    test(`change to ${file} selects base`, async () => {
        const before = fixtureTree()
        const after = { ...before, [file]: before[file] + '\n ' }
        assert.equal(await selection(before, after), 'base')
    })
}

for (const file of ['scripts/screens/capture.ts', 'src/dev/screens/catalogue.ts']) {
    test(`unreferenced ${file} change retains head`, async () => {
        const before = fixtureTree()
        assert.equal(await selection(before, { ...before, [file]: 'export const changed = true;' }), 'head')
    })
    test(`actual fixture dependency on ${file} selects base when changed`, async () => {
        const before = fixtureTree()
        const specifier = file.startsWith('scripts/') ? '../../../scripts/screens/capture' : '../screens/catalogue'
        before['src/dev/fixtures/index.ts'] = `import '${specifier}'; export const fixture = {};`
        assert.equal(await selection(before, { ...before, [file]: 'export const changed = true;' }), 'base')
    })
}

test('fixture root addition and deletion select base even with identical bytes', async () => {
    const before = fixtureTree()
    const after = { ...before, 'src/dev/fixtures/added.ts': before['src/dev/fixtures/index.ts'] }
    assert.equal(await selection(before, after), 'base')
    assert.equal(await selection(after, before), 'base')
})

test('dependency path identity participates even when dependency bytes match', async () => {
    const before = fixtureTree()
    const after = { ...before }
    delete after['src/utils/nested.ts']
    after['src/utils/nested/index.ts'] = before['src/utils/nested.ts']
    assert.equal(await selection(before, after), 'base')
})

test('shared fixture roots include required synthetic inputs and exclude capture catalogue', async () => {
    const { fixtureRootFiles } = await import('./capture-impact.mjs')
    const roots = fixtureRootFiles(Object.keys(fixtureTree()))
    assert.deepEqual(
        new Set(roots),
        new Set([
            'src/dev/fixtures/index.ts',
            'src/utils/demo-api.ts',
            'src/constants/demo-data.ts',
            'src/constants/residence.consts.ts',
            'src/types/api.openapi.json',
        ])
    )
})
