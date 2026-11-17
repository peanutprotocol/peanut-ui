import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import test from 'node:test'

const externalPayer = '0x7a3f9c41d2e8b05a6f13c47e92d0ab58e1f491c2'
const choiceIds = ['79-f-choice-direct-send', '80-f-choice-semantic-request']

const probes = [
    `
const fixture = 'history-request-paid-external';
const path = '/ens/reverse/${externalPayer}';
const response = await answer(fixture, path, 'GET');
console.log('RESULT:' + JSON.stringify({
    status: response.status,
    body: await response.json(),
    registered: Object.hasOwn(FIXTURES[fixture].responses, 'GET ' + path),
}));
`,
    `
const rejected = [];
for (const path of ['/not-a-fixture', '/ens/reverse/0x0000000000000000000000000000000000000001']) {
    try {
        await answer('history-request-paid-external', path, 'GET');
        rejected.push(false);
    } catch {
        rejected.push(true);
    }
}
console.log('RESULT:' + JSON.stringify(rejected));
`,
    `
const values = [];
for (const id of ${JSON.stringify(choiceIds)}) {
    const matches = SCREENS.filter(screen => screen.id === id);
    const screen = matches[0];
    if (!screen) { values.push({ id, count: matches.length }); continue; }
    const fixture = FIXTURES[screen.fixture];
    values.push({
        id,
        count: matches.length,
        route: screen.route,
        expectSelector: screen.expectSelector,
        fixtureRegistered: !!fixture,
    });
}
console.log('RESULT:' + JSON.stringify(values));
`,
    `
const values = [];
for (const locale of ['en', 'es-419', 'es-AR', 'pt-BR']) {
    const response = await answer(
        'history-request-pot-closed-short',
        '/receipt/fixture-request-pot-closed-short/pdf?kind=P2P_REQUEST_FULFILL&locale=' + locale + '&v=opaque',
        'GET'
    );
    values.push({locale, status: response.status, contentType: response.headers.get('content-type'), bytes: await response.text()});
}
console.log('RESULT:' + JSON.stringify(values));
`,
    `
const path = '/receipt/fixture-request-pot-closed-short/pdf?kind=P2P_REQUEST_FULFILL&locale=en&v=opaque';
const requests = [
    ['history-request-pot-closed-short', '/receipt/unknown-receipt/pdf?kind=P2P_REQUEST_FULFILL&locale=en&v=opaque', 'GET'],
    ['history-request-pot-closed-short', path, 'POST'],
    ['history-request-pot-closed-short', path, 'DELETE'],
    ['home', path, 'GET'],
];
const rejected = [];
for (const [fixture, pathname, method] of requests) {
    try {
        await answer(fixture, pathname, method);
        rejected.push(false);
    } catch {
        rejected.push(true);
    }
}
console.log('RESULT:' + JSON.stringify(rejected));
`,
    `
const fixture = 'history-request-pot-closed-short';
const entryResponse = await answer(fixture, '/history/fixture-request-pot-closed-short', 'GET');
const historyResponse = await answer(fixture, '/users/history', 'GET');
console.log('RESULT:' + JSON.stringify({
    entryStatus: entryResponse.status,
    historyStatus: historyResponse.status,
    entry: await entryResponse.json(),
    history: await historyResponse.json(),
}));
`,
    `
const origin = 'http://localhost:3000';
const accepted = [
    '/receipt/id/pdf',
    '/receipt/fixture-request-pot-closed-short/pdf?kind=P2P_REQUEST_FULFILL&locale=es-AR&v=opaque',
].map(path => adapter.isReceiptPdfRequest(new URL(path, origin), origin));
const rejected = [
    'https://untrusted.example/receipt/id/pdf',
    '/receipt/id',
    '/receipt/id/nested/pdf',
    '/receipt/id/pdf-extra',
    '/receipt//pdf',
    '/receipt/pdf',
    '/receipt/id/pdf/extra',
].map(path => adapter.isReceiptPdfRequest(new URL(path, origin), origin));
console.log('RESULT:' + JSON.stringify({ accepted, rejected }));
`,
]
let probeResults
let probeFailure
let probeAttempted = false

function runFixtureProbe(index) {
    if (!probeAttempted) {
        probeAttempted = true
        try {
            const output = execFileSync(
                process.execPath,
                [
                    '--import',
                    'tsx',
                    '--input-type=module',
                    '-e',
                    `
import adapter from './scripts/screens/adapter.ts';
import catalogue from './src/dev/screens/catalogue.ts';
import registry from './src/dev/fixtures/registry.ts';
const { answer } = adapter;
const { SCREENS } = catalogue;
const { FIXTURES } = registry;
globalThis.fetch = () => { throw new Error('Unexpected network request'); };
const results = [];
${probes
    .map(
        (source) => `
try {
    results.push(await (async () => {
        let result;
        const console = { log(value) { result = JSON.parse(value.slice('RESULT:'.length)); } };
        ${source}
        return result;
    })());
} catch (error) {
    results.push({ error: String(error) });
}
`
    )
    .join('')}
console.log('RESULT:' + JSON.stringify(results));
`,
                ],
                { encoding: 'utf8', timeout: 120_000, killSignal: 'SIGKILL' }
            )
            const result = output.split('RESULT:')[1]
            assert.ok(result, 'fixture probe must return its result')
            probeResults = JSON.parse(result)
        } catch (error) {
            probeFailure = error
        }
    }
    if (probeFailure) throw probeFailure
    const result = probeResults[index]
    assert.equal(result?.error, undefined, `fixture probe ${index}: ${result?.error}`)
    return result
}

test('completed external request payer has an explicit synthetic unnamed ENS response', () => {
    const result = runFixtureProbe(0)
    assert.equal(result.status, 200)
    assert.deepEqual(result.body, { name: null })
    assert.equal(result.registered, true, 'the external payer lookup must be explicitly fixture-owned')
})

test('external payer ENS coverage does not permit unknown fixture requests', () => {
    const result = runFixtureProbe(1)
    assert.deepEqual(result, [true, true], 'unknown paths and unrelated ENS addresses must still reject')
})

test('named payment choice screens retain registered capture routes and readiness selectors', () => {
    const result = runFixtureProbe(2)
    assert.deepEqual(
        result.map(({ id }) => id),
        choiceIds
    )
    for (const screen of result) {
        assert.equal(screen.count, 1, `${screen.id} must remain uniquely registered`)
        assert.equal(screen.fixtureRegistered, true, `${screen.id} must use a registered fixture`)
        assert.match(screen.route, /^\//, `${screen.id} must retain an application capture route`)
        assert.equal(typeof screen.expectSelector, 'string', `${screen.id} needs a readiness selector`)
        assert.ok(screen.expectSelector.trim(), `${screen.id} readiness selector must not be blank`)
    }
})

test('closed-short request pot provides its declared PDF prefetch without network access', () => {
    const result = runFixtureProbe(3)
    assert.deepEqual(
        result.map(({ locale }) => locale),
        ['en', 'es-419', 'es-AR', 'pt-BR']
    )
    for (const response of result) {
        assert.equal(response.status, 200, response.locale)
        assert.match(response.contentType, /^application\/pdf(?:;|$)/)
        assert.ok(response.bytes.startsWith('%PDF-'), 'prefetch must receive PDF bytes')
        assert.ok(response.bytes.trimEnd().endsWith('%%EOF'), 'synthetic PDF must have an EOF marker')
    }
})

test('synthetic receipt PDF access stays restricted to declared fixture, receipt, and method', () => {
    const result = runFixtureProbe(4)
    assert.deepEqual(result, [true, true, true, true])
})

test('PDF support preserves the closed-short request pot lifecycle and amounts', () => {
    const result = runFixtureProbe(5)
    assert.equal(result.entryStatus, 200)
    assert.equal(result.historyStatus, 200)
    for (const entry of [result.entry, result.history.entries[0]]) {
        assert.equal(entry.uuid, 'fixture-request-pot-closed-short')
        assert.equal(entry.status, 'CLOSED')
        assert.equal(entry.completedAt, null)
        assert.equal(entry.totalAmountCollected, 73.65)
        assert.equal(entry.amount, '99.16')
    }
})

test('receipt PDF interception matches only same-origin single-receipt PDF routes', () => {
    const result = runFixtureProbe(6)
    assert.deepEqual(result.accepted, [true, true])
    assert.deepEqual(result.rejected, [false, false, false, false, false, false, false])
})
