import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import { PNG } from 'pngjs'
import { compare, validateCapture, storeAsset } from './core.mjs'
import { canReuseBaseline } from './baseline-reuse.mjs'

const scratch = mkdtempSync(join(tmpdir(), 'revision-fixtures-tests-'))
test.after(() => rmSync(scratch, { recursive: true, force: true }))

function put(root, name, contents) {
    const file = join(root, name)
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, contents)
}

function source(label = 'BEFORE', overrides = {}) {
    const root = mkdtempSync(join(scratch, 'source-'))
    const files = {
        'package.json': '{"type":"module"}',
        'pnpm-lock.yaml': 'lockfileVersion: 9.0\n',
        // A historical tsconfig must not control the head fixture loader.
        'tsconfig.json': '{"extends":"./must-not-load-this-config.json"}',
        'scripts/screens/adapter.ts':
            "export const ADAPTER_VERSION = 'synthetic-api-v2'; throw new Error('SOURCE_ADAPTER_EXECUTED');",
        'src/dev/fixtures/registry.ts':
            "import { countryCode } from '@/dev/fixtures/helper'; export const FIXTURES = {home: {responses: {'GET /users/me': {user: {residence: {countryCode}}}}}};",
        'src/dev/fixtures/helper.ts': "export { countryCode } from './value';",
        'src/dev/fixtures/value.ts': `export const countryCode = ${JSON.stringify(label)};`,
        'src/utils/demo-api.ts': `export function demoRespond() { return Response.json({user: {residence: {countryCode: ${JSON.stringify(label + '-DEMO')}}}}); }`,
        'src/constants/residence.consts.ts':
            "export const RESTRICTED_RESIDENCE_ISO2 = ['ZZ']; export const CARD_RESTRICTED_RESIDENCE_ISO2 = ['YY']; export const BANKING_RESTRICTED_RESIDENCE_ISO2 = ['XX'];",
        'src/types/api.openapi.json': '{}',
        ...overrides,
    }
    for (const [name, contents] of Object.entries(files)) {
        if (contents !== null) put(root, name, contents)
    }
    execFileSync('git', ['init', '--quiet', root], { timeout: 10_000 })
    execFileSync('git', ['-C', root, 'add', '.'], { timeout: 10_000 })
    return root
}

async function identity(root) {
    const { captureFixtures } = await import('./capture-fixtures.mjs')
    return captureFixtures(root)
}

function probe(body) {
    const output = execFileSync(
        process.execPath,
        [
            '--import',
            'tsx',
            '--input-type=module',
            '-e',
            `import * as imported from './scripts/screens/revision-adapter.ts';
             const {revisionAdapter} = imported.default ?? imported;
             let networkRequests = 0;
             globalThis.fetch = () => {networkRequests++; throw new Error('Unexpected live request')};
             ${body}
             console.log('RESULT:' + JSON.stringify({result, networkRequests}));
             process.exit(0);`,
        ],
        { encoding: 'utf8', timeout: 30_000, maxBuffer: 1024 * 1024 }
    )
    const resultLine = output.split('\n').find((line) => line.startsWith('RESULT:'))
    assert.ok(resultLine, 'probe must return a structured result')
    const parsed = JSON.parse(resultLine.slice('RESULT:'.length))
    assert.equal(parsed.networkRequests, 0)
    return parsed.result
}

test('identity is deterministic, source-relative, sorted, and includes transitive fixture inputs', async () => {
    const root = source()
    const first = await identity(root)
    assert.match(first.fixtures, /^[a-f0-9]{64}$/)
    assert.equal(first.version, 'synthetic-api-v2')
    assert.equal(first.unavailableReason, undefined)
    assert.deepEqual(await identity(root), first)
    assert.deepEqual(first.files, [...first.files].sort())
    assert.equal(new Set(first.files).size, first.files.length)
    for (const name of [
        'src/dev/fixtures/registry.ts',
        'src/dev/fixtures/helper.ts',
        'src/dev/fixtures/value.ts',
        'src/utils/demo-api.ts',
        'src/constants/residence.consts.ts',
        'src/types/api.openapi.json',
        'package.json',
        'pnpm-lock.yaml',
    ])
        assert.ok(first.files.includes(name), `identity must include ${name}`)
    assert.ok(first.files.every((name) => !name.startsWith('/') && !name.split('/').includes('..')))
    assert.deepEqual(await identity(source()), first, 'checkout path must not affect fixture identity')
})

test('each runtime root, transitive helper, package manifest, and lockfile changes the fixture identity', async () => {
    const base = await identity(source())
    const changes = {
        'src/dev/fixtures/registry.ts': 'export const FIXTURES = {home: {responses: {}}};',
        'src/dev/fixtures/value.ts': "export const countryCode = 'CHANGED';",
        'src/utils/demo-api.ts': 'export function demoRespond() { return null; }',
        'src/constants/residence.consts.ts':
            'export const RESTRICTED_RESIDENCE_ISO2 = []; export const CARD_RESTRICTED_RESIDENCE_ISO2 = []; export const BANKING_RESTRICTED_RESIDENCE_ISO2 = [];',
        'src/types/api.openapi.json': '{"paths":{}}',
        'package.json': '{"type":"module","version":"2.0.0"}',
        'pnpm-lock.yaml': 'lockfileVersion: 9.0\nsettings:\n  autoInstallPeers: false\n',
    }
    for (const [file, content] of Object.entries(changes)) {
        assert.notEqual((await identity(source('BEFORE', { [file]: content }))).fixtures, base.fixtures, file)
    }
})

test('missing historical roots or adapter and unsupported versions are explicitly unavailable', async () => {
    for (const file of [
        'scripts/screens/adapter.ts',
        'src/dev/fixtures/registry.ts',
        'src/utils/demo-api.ts',
        'src/constants/residence.consts.ts',
        'src/types/api.openapi.json',
    ]) {
        const result = await identity(source('BEFORE', { [file]: null }))
        assert.equal(typeof result.unavailableReason, 'string', file)
        assert.ok(result.unavailableReason.length > 0, file)
    }
    const unsupported = await identity(
        source('BEFORE', {
            'scripts/screens/adapter.ts': "export const ADAPTER_VERSION = 'historical-unsupported';",
        })
    )
    assert.equal(typeof unsupported.unavailableReason, 'string')
    assert.ok(unsupported.unavailableReason.length > 0)
})

test('a missing transitive dependency is an error rather than historical unavailability', async () => {
    const { captureFixtures } = await import('./capture-fixtures.mjs')
    const root = source('BEFORE', { 'src/dev/fixtures/value.ts': null })
    await assert.rejects(async () => captureFixtures(root))
})

test('two revisions retain their own fixtures under the head answer orchestration', async () => {
    const before = source('BEFORE')
    const after = source('AFTER')
    const result = probe(`
        const before = await revisionAdapter(${JSON.stringify(before)});
        const after = await revisionAdapter(${JSON.stringify(after)});
        const result = [];
        for (const adapter of [before, after, before]) {
            const response = await adapter.answer('home', '/users/me', 'GET');
            const residence = await adapter.answer('home', '/config/residence-restrictions', 'GET');
            result.push({countryCode: (await response.json()).user.residence.countryCode,
                full: (await residence.json()).full, status: response.status,
                fixtures: adapter.fixtures, adapter: adapter.adapter,
                unavailable: adapter.unavailableReason ?? null,
                home: adapter.hasFixture('home'), headOnly: adapter.hasFixture('history-request-paid-external')});
        }
    `)
    assert.deepEqual(
        result.map((item) => item.countryCode),
        ['BEFORE', 'AFTER', 'BEFORE']
    )
    assert.notEqual(result[0].fixtures, result[1].fixtures)
    assert.equal(result[0].fixtures, (await identity(before)).fixtures)
    for (const item of result) {
        assert.deepEqual(item.full, ['ZZ'])
        assert.equal(item.status, 200)
        assert.equal(item.adapter, 'synthetic-api-v2')
        assert.equal(item.unavailable, null)
        assert.equal(item.home, true)
        assert.equal(item.headOnly, false)
    }
})

test('source demo responses and source OpenAPI examples are used without head data leakage', () => {
    const demo = source('BASE', {
        'src/dev/fixtures/registry.ts': 'export const FIXTURES = {home: {responses: {}}};',
    })
    const openapi = source('BASE', {
        'src/dev/fixtures/registry.ts': 'export const FIXTURES = {home: {responses: {}}};',
        'src/utils/demo-api.ts':
            "export function demoRespond(path, options = {}) { throw new Error('Unmapped capture API: ' + (options.method ?? 'GET') + ' ' + path); }",
        'src/types/api.openapi.json': JSON.stringify({
            paths: {
                '/source-example': {
                    get: {
                        responses: {
                            201: { content: { 'application/json': { example: { source: 'BASE-OPENAPI' } } } },
                        },
                    },
                },
            },
        }),
    })
    const result = probe(`
        const demo = await revisionAdapter(${JSON.stringify(demo)});
        const openapi = await revisionAdapter(${JSON.stringify(openapi)});
        const first = await demo.answer('home', '/users/me', 'GET');
        const second = await openapi.answer('home', '/source-example', 'GET');
        const result = {demo: await first.json(), example: await second.json(), status: second.status};
    `)
    assert.equal(result.demo.user.residence.countryCode, 'BASE-DEMO')
    assert.deepEqual(result.example, { source: 'BASE-OPENAPI' })
    assert.equal(result.status, 201)
})

test('missing historical inputs yield unavailable adapters but source module faults throw', () => {
    const missing = source('BEFORE', { 'src/dev/fixtures/registry.ts': null })
    const broken = source('BEFORE', {
        'src/dev/fixtures/registry.ts': "throw new Error('SOURCE_RUNTIME_FAULT'); export const FIXTURES = {};",
    })
    const result = probe(`
        const missing = await revisionAdapter(${JSON.stringify(missing)});
        let runtimeError;
        try { await revisionAdapter(${JSON.stringify(broken)}); }
        catch (error) { runtimeError = String(error); }
        const result = {unavailable: missing.unavailableReason, hasFixture: missing.hasFixture('home'), runtimeError};
    `)
    assert.equal(typeof result.unavailable, 'string')
    assert.ok(result.unavailable.length > 0)
    assert.equal(result.hasFixture, false)
    assert.match(result.runtimeError, /SOURCE_RUNTIME_FAULT/)
})

test('unmapped API requests remain failures in an available revision adapter', () => {
    const root = source('BEFORE', {
        'src/utils/demo-api.ts':
            "export function demoRespond(path, options = {}) { throw new Error('Unmapped capture API: ' + (options.method ?? 'GET') + ' ' + path); }",
    })
    const result = probe(`
        const adapter = await revisionAdapter(${JSON.stringify(root)});
        const errors = [];
        for (const [path, method] of [['/not-a-fixture', 'GET'], ['/users/me', 'DELETE']]) {
            try { await adapter.answer('home', path, method); errors.push(null); }
            catch (error) { errors.push(String(error)); }
        }
        const result = {errors, unavailable: adapter.unavailableReason ?? null};
    `)
    assert.equal(result.unavailable, null)
    assert.ok(result.errors.every((error) => typeof error === 'string' && error.includes('Unmapped capture API')))
})

const pixels = new PNG({ width: 393, height: 852 })
pixels.data.fill(255)
const asset = storeAsset(scratch, PNG.sync.write(pixels))
function manifest(commit = 'a'.repeat(40), fixtures = 'd'.repeat(64), marked = true) {
    return {
        schema: 1,
        type: 'capture',
        commit,
        contentCommit: commit,
        harness: 'c'.repeat(64),
        fixtures,
        ...(marked ? { fixtureSource: commit } : {}),
        environment: 'test',
        publicBase: 'https://staging.peanut.me',
        adapter: 'synthetic-api-v2',
        capturedAt: '2026-09-10T00:00:00Z',
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
                image: asset,
                thumbnail: asset,
            },
        ],
        inventory: [{ route: '/home', status: 'catalogued', screens: ['home'] }],
    }
}

test('capture provenance survives validation and cannot claim another source revision', () => {
    const valid = manifest()
    assert.equal(validateCapture(valid).fixtureSource, valid.commit)
    for (const invalid of ['b'.repeat(40), '', true, null, 'not-a-commit']) {
        assert.throws(() => validateCapture({ ...valid, fixtureSource: invalid }))
    }
    assert.equal(validateCapture(manifest(undefined, undefined, false)).fixtureSource, undefined)
})

test('provenance allows fixture differences while preserving renderer compatibility gates', () => {
    const before = manifest()
    const after = manifest('b'.repeat(40), 'e'.repeat(64))
    assert.equal(compare(before, after, scratch).screens[0].status, 'unchanged')
    for (const [key, value] of Object.entries({
        harness: 'f'.repeat(64),
        environment: 'other',
        adapter: 'other',
        publicBase: 'https://other.example',
    }))
        assert.throws(() => compare(before, { ...after, [key]: value }, scratch), /environments differ/)
    assert.throws(() => compare(before, { ...after, locale: 'pt-BR', profile: 'pt-BR-393x852' }, scratch))
})

test('legacy comparisons require equal fixtures and cannot mix provenance modes', () => {
    const legacy = manifest(undefined, undefined, false)
    assert.equal(compare(legacy, { ...legacy, commit: 'b'.repeat(40) }, scratch).screens[0].status, 'unchanged')
    assert.throws(() => compare(legacy, { ...legacy, fixtures: 'e'.repeat(64) }, scratch))
    assert.throws(() => compare(legacy, manifest(), scratch))
    assert.throws(() => compare(manifest(), legacy, scratch))
})

test('marked baseline reuse compares the actual before digest, not the changed head digest', () => {
    const before = manifest()
    const after = manifest('b'.repeat(40), 'e'.repeat(64))
    assert.equal(canReuseBaseline(before, after, before.commit, before.fixtures), true)
    assert.equal(canReuseBaseline(before, after, before.commit, after.fixtures), false)
    assert.equal(canReuseBaseline(before, after, before.commit), false)
    assert.equal(canReuseBaseline(before, after, 'f'.repeat(40), before.fixtures), false)
    assert.equal(canReuseBaseline(before, { ...after, harness: 'f'.repeat(64) }, before.commit, before.fixtures), false)
    const { fixtureSource, ...legacyBefore } = before
    assert.equal(canReuseBaseline(legacyBefore, after, before.commit, before.fixtures), false)
    assert.equal(canReuseBaseline(before, legacyBefore, before.commit, before.fixtures), false)
})

test('legacy baseline callers retain strict fixture equality', () => {
    const before = manifest(undefined, undefined, false)
    const after = manifest('b'.repeat(40), before.fixtures, false)
    assert.equal(canReuseBaseline(before, after, before.commit), true)
    assert.equal(canReuseBaseline(before, { ...after, fixtures: 'e'.repeat(64) }, before.commit), false)
})

test('legacy response shapes survive concurrent before-after-before requests', () => {
    const beforeShape = {
        residence: 'BEFORE-LEGACY-RESIDENCE',
        notificationPreferences: ['legacy-email'],
        planPreferences: ['legacy-free'],
    }
    const afterShape = {
        residence: { countryCode: 'AFTER', region: 'AFTER-REGION' },
        notificationPreferences: { email: true, push: false },
        planPreferences: { selected: 'after-premium' },
    }
    const registry = (user) =>
        `export const FIXTURES = ${JSON.stringify({ home: { responses: { 'GET /users/me': { user } } } })};`
    const before = source('BEFORE', { 'src/dev/fixtures/registry.ts': registry(beforeShape) })
    const after = source('AFTER', { 'src/dev/fixtures/registry.ts': registry(afterShape) })
    const result = probe(`
        const before = await revisionAdapter(${JSON.stringify(before)});
        const after = await revisionAdapter(${JSON.stringify(after)});
        const result = await Promise.all([before, after, before].map(async (adapter) => {
            const response = await adapter.answer('home', '/users/me', 'GET');
            const {residence, notificationPreferences, planPreferences} = (await response.json()).user;
            return {residence, notificationPreferences, planPreferences};
        }));
    `)
    assert.deepEqual(result, [beforeShape, afterShape, beforeShape])
})
