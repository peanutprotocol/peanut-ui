import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'

function probeExternalPaidRequest(paths, method = 'GET') {
    const output = execFileSync(
        process.execPath,
        [
            '--import',
            'tsx',
            '--input-type=module',
            '-e',
            `
 import adapter from './scripts/screens/adapter.ts'; const {answer}=adapter;
 let networkRequests=0;
 globalThis.fetch=()=>{networkRequests++;throw new Error('Unexpected network request')};
 const values=[];
 for(const path of ${JSON.stringify(paths)}) {
 try {
 const response=await answer('history-request-paid-external',path,${JSON.stringify(method)});
 values.push({status:response.status,body:await response.json()});
 } catch(error) { values.push({error:String(error)}); }
 }
 console.log('RESULT:'+JSON.stringify({values,networkRequests}));
 `,
        ],
        { encoding: 'utf8' }
    )
    return JSON.parse(output.split('RESULT:')[1])
}

test('external paid-request reverse ENS is a deterministic synthetic miss, including query strings', () => {
    const path = '/ens/reverse/0x7a3f9c41d2e8b05a6f13c47e92d0ab58e1f491c2'
    const result = probeExternalPaidRequest([path, path, `${path}?capture=1`])

    assert.equal(result.networkRequests, 0)
    assert.deepEqual(result.values, [
        { status: 200, body: { name: null } },
        { status: 200, body: { name: null } },
        { status: 200, body: { name: null } },
    ])
})

test('external paid-request keeps unknown endpoints and unsupported methods strict', () => {
    const results = [
        probeExternalPaidRequest(['/not-a-fixture', '/not-a-fixture?capture=1']),
        probeExternalPaidRequest(['/ens/reverse/0x7a3f9c41d2e8b05a6f13c47e92d0ab58e1f491c2'], 'POST'),
    ]

    for (const result of results) {
        assert.equal(result.networkRequests, 0)
        for (const value of result.values) {
            assert.equal(typeof value.error, 'string', 'unmapped requests must throw')
            assert.ok(value.error.length > 0)
        }
    }
})

test('strict synthetic transport answers shared config and legacy rates without live requests', () => {
    const output = execFileSync(
        process.execPath,
        [
            '--import',
            'tsx',
            '--input-type=module',
            '-e',
            `
 import adapter from './scripts/screens/adapter.ts'; const {answer}=adapter;
 globalThis.fetch=()=>{throw new Error('Unexpected network request')};
 const values=[];
 for(const path of ['/users/me','/config/residence-restrictions','/tokens/price?chainId=42161&address=synthetic','/bridge/onramp/quote?accountType=iban','/qr/synthetic-invalid']) {
 const r=await answer('home',path,'GET'); values.push({status:r.status,body:await r.json()});
 }
 let rejected=false;try{await answer('home','/not-a-fixture','GET')}catch{rejected=true};
 console.log('RESULT:'+JSON.stringify({values,rejected}));
 `,
        ],
        { encoding: 'utf8' }
    )
    const result = JSON.parse(output.split('RESULT:')[1])
    assert.ok(result.rejected)
    assert.ok(result.values.every((r) => r.status === 200))
    assert.equal(result.values[0].body.user.activationCelebratedAt, '2026-01-01T00:00:00Z')
    assert.ok(Array.isArray(result.values[1].body.full))
    assert.equal(result.values[2].body.price, 1)
    assert.equal(result.values[3].body.from, 'EUR')
    assert.equal(result.values[4].body.available, false)
})

function probeWithSpec(fixture, requests, spec) {
    const output = execFileSync(
        process.execPath,
        [
            '--import',
            'tsx',
            '--input-type=module',
            '-e',
            `
 import adapter from './scripts/screens/adapter.ts'; const {answer}=adapter;
 let networkRequests=0;
 globalThis.fetch=()=>{networkRequests++;throw new Error('Unexpected network request')};
 const spec=${JSON.stringify(spec) ?? 'undefined'};
 const values=[];
 for(const [method,path] of ${JSON.stringify(requests)}) {
 try {
 const response=await answer(${JSON.stringify(fixture)},path,method,undefined,spec);
 values.push({status:response.status,body:await response.json()});
 } catch(error) { values.push({error:String(error)}); }
 }
 console.log('RESULT:'+JSON.stringify({values,networkRequests}));
 `,
        ],
        { encoding: 'utf8' }
    )
    return JSON.parse(output.split('RESULT:')[1])
}

const example = (status, value) => ({
    responses: { [status]: { content: { 'application/json': { example: value } } } },
})
const EXAMPLE_SPEC = {
    paths: {
        '/users/kyc/attempts/{attemptId}/token': { post: example(201, { token: 'synthetic-example-token' }) },
        '/capture-only/undocumented': { get: { responses: { 200: { description: 'No example' } } } },
        '/users/me': { get: example(200, { user: { username: 'from-example' } }) },
        '/tokens/price': { get: example(200, { price: 999 }) },
    },
}

test('unmapped routes answer with their OpenAPI example and status', () => {
    const result = probeWithSpec(
        'home',
        [
            ['POST', '/users/kyc/attempts/attempt-1/token'],
            ['POST', '/users/kyc/attempts/attempt-1/token?retry=1'],
        ],
        EXAMPLE_SPEC
    )
    assert.equal(result.networkRequests, 0)
    assert.deepEqual(result.values, [
        { status: 201, body: { token: 'synthetic-example-token' } },
        { status: 201, body: { token: 'synthetic-example-token' } },
    ])
})

test('unmapped routes without an example still fail the screen', () => {
    for (const spec of [EXAMPLE_SPEC, undefined]) {
        const result = probeWithSpec(
            'home',
            [
                ['GET', '/capture-only/undocumented'],
                ['GET', '/not-a-fixture'],
                ['DELETE', '/users/kyc/attempts/attempt-1/token'],
            ],
            spec
        )
        assert.equal(result.networkRequests, 0)
        assert.deepEqual(
            result.values.map((value) => value.error),
            [
                'Error: Unmapped capture API: GET /capture-only/undocumented',
                'Error: Unmapped capture API: GET /not-a-fixture',
                'Error: Unmapped capture API: DELETE /users/kyc/attempts/attempt-1/token',
            ]
        )
    }
})

test('fixture overrides and demo-api answers win over OpenAPI examples', () => {
    const requests = [
        ['GET', '/users/me'],
        ['GET', '/tokens/price?chainId=42161&address=synthetic'],
    ]
    const withExamples = probeWithSpec('home', requests, EXAMPLE_SPEC)
    assert.deepEqual(withExamples, probeWithSpec('home', requests, {}))
    assert.notEqual(withExamples.values[0].body.user.username, 'from-example')
    assert.equal(withExamples.values[1].body.price, 1)

    const failing = probeWithSpec('withdraw-crypto-eth-no-price', [['GET', '/tokens/price']], EXAMPLE_SPEC)
    assert.deepEqual(failing.values, [{ status: 500, body: { error: 'Synthetic failure' } }])
})
