import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'

const json = (example) => ({ content: { 'application/json': { example } } })
const SPEC = {
    paths: {
        '/users/kyc/attempts/{attemptId}/token': { get: { responses: { 200: json({ token: 'template' }) } } },
        '/users/me': { get: { responses: { 200: json({ from: 'literal' }) } } },
        '/users/{userId}': {
            get: { responses: { 200: json({ from: 'template' }) } },
            post: { responses: { 200: json({ from: 'template-post' }) } },
        },
        '/a/{x}/c': { get: { responses: { 200: json({ from: 'late literal' }) } } },
        '/a/b/{y}': { get: { responses: { 200: json({ from: 'early literal' }) } } },
        '/codes': {
            get: {
                responses: {
                    400: json({ error: 'bad' }),
                    202: json({ status: 'accepted' }),
                    201: json({ status: 'created' }),
                    204: { description: 'No content' },
                },
            },
        },
        '/codes/undocumented': {
            get: {
                responses: {
                    200: { content: { 'application/json': { schema: { type: 'object' } } } },
                    201: json({ created: true }),
                },
            },
        },
        '/codes/text': { get: { responses: { 200: { content: { 'text/plain': { example: 'plain' } } } } } },
        '/codes/errors-only': { get: { responses: { 400: json({ error: 'bad' }) } } },
        '/codes/no-body': { delete: { responses: { 204: json(null) } } },
        '/codes/null': { get: { responses: { 200: json(null) } } },
        '/examples': {
            get: {
                responses: {
                    200: {
                        content: {
                            'application/json': {
                                examples: {
                                    empty: { summary: 'No value' },
                                    first: { summary: 'First', value: { n: 1 } },
                                    second: { value: { n: 2 } },
                                },
                            },
                        },
                    },
                },
            },
        },
        '/examples/both': {
            get: {
                responses: {
                    200: {
                        content: {
                            'application/json': { example: { from: 'example' }, examples: { a: { value: 1 } } },
                        },
                    },
                },
            },
        },
        '/examples/ref': { get: { responses: { 200: { $ref: '#/components/responses/Shared' } } } },
    },
    components: {
        responses: {
            Shared: {
                content: { 'application/json': { examples: { only: { $ref: '#/components/examples/Shared' } } } },
            },
        },
        examples: { Shared: { value: { shared: true } } },
    },
}

function lookup(spec, requests) {
    const output = execFileSync(
        process.execPath,
        [
            '--import',
            'tsx',
            '--input-type=module',
            '-e',
            `
 import lookup from './scripts/screens/openapi-example.ts'; const {exampleFor}=lookup;
 const spec=${JSON.stringify(spec) ?? 'undefined'};
 console.log('RESULT:'+JSON.stringify(${JSON.stringify(requests)}.map(([method,path])=>exampleFor(spec,method,path)??'none')));
 `,
        ],
        { encoding: 'utf8' }
    )
    return JSON.parse(output.split('RESULT:')[1])
}

test('matches path templates segment by segment, preferring literal segments', () => {
    assert.deepEqual(
        lookup(SPEC, [
            ['GET', '/users/kyc/attempts/att_1/token'],
            ['GET', '/users/me'],
            ['GET', '/users/42'],
            ['POST', '/users/me'],
            ['GET', '/a/b/c'],
            ['GET', '/users/me/extra'],
            ['GET', '/users'],
            ['PUT', '/users/me'],
            ['GET', '/missing'],
        ]),
        [
            { status: 200, data: { token: 'template' } },
            { status: 200, data: { from: 'literal' } },
            { status: 200, data: { from: 'template' } },
            { status: 200, data: { from: 'template-post' } },
            { status: 200, data: { from: 'early literal' } },
            'none',
            'none',
            'none',
            'none',
        ]
    )
})

test('ignores query strings, fragments and trailing slashes, and decodes segments', () => {
    assert.deepEqual(
        lookup(SPEC, [
            ['GET', '/users/me?include=all'],
            ['GET', '/users/me/'],
            ['GET', '/users/me#top'],
            ['GET', '/users/%6De'],
            ['GET', '/users/kyc/attempts/att%201/token?retry=1'],
        ]),
        [
            { status: 200, data: { from: 'literal' } },
            { status: 200, data: { from: 'literal' } },
            { status: 200, data: { from: 'literal' } },
            { status: 200, data: { from: 'literal' } },
            { status: 200, data: { token: 'template' } },
        ]
    )
})

test('answers with the lowest 2xx JSON response that documents an example', () => {
    assert.deepEqual(
        lookup(SPEC, [
            ['GET', '/codes'],
            ['GET', '/codes/undocumented'],
            ['GET', '/codes/text'],
            ['GET', '/codes/errors-only'],
            ['DELETE', '/codes/no-body'],
            ['GET', '/codes/null'],
        ]),
        [
            { status: 201, data: { status: 'created' } },
            { status: 201, data: { created: true } },
            'none',
            'none',
            'none',
            { status: 200, data: null },
        ]
    )
})

test('reads example, else the first examples value, through local $refs', () => {
    assert.deepEqual(
        lookup(SPEC, [
            ['GET', '/examples'],
            ['GET', '/examples/both'],
            ['GET', '/examples/ref'],
        ]),
        [
            { status: 200, data: { n: 1 } },
            { status: 200, data: { from: 'example' } },
            { status: 200, data: { shared: true } },
        ]
    )
})

test('a missing or malformed spec has no examples', () => {
    for (const spec of [undefined, null, {}, { paths: [] }, { paths: { '/users/me': null } }])
        assert.deepEqual(lookup(spec, [['GET', '/users/me']]), ['none'])
})

test('every operation in the synced spec resolves to its own example or none', () => {
    const output = execFileSync(
        process.execPath,
        [
            '--import',
            'tsx',
            '--input-type=module',
            '-e',
            `
 import spec from './src/types/api.openapi.json';
 import lookup from './scripts/screens/openapi-example.ts'; const {exampleFor}=lookup;
 const results=[];
 for(const [template,item] of Object.entries(spec.paths)) for(const method of Object.keys(item)) {
 const result=exampleFor(spec,method.toUpperCase(),template.replace(/\\{[^}]+\\}/g,'synthetic'));
 results.push(result===undefined||(result.status>=200&&result.status<300));
 }
 console.log('RESULT:'+JSON.stringify({results,unknown:exampleFor(spec,'GET','/not-a-documented-route')??'none'}));
 `,
        ],
        { encoding: 'utf8' }
    )
    const result = JSON.parse(output.split('RESULT:')[1])
    assert.ok(result.results.length > 100)
    assert.ok(result.results.every(Boolean))
    assert.equal(result.unknown, 'none')
})
