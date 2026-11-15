/** @jest-environment node */
const fs = require('fs')
const os = require('os')
const path = require('path')
const { calledApiOperations } = require('../api-called-operations')

describe('called API operation discovery', () => {
    let sourceDir

    beforeEach(() => {
        sourceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'api-operations-'))
    })

    afterEach(() => {
        fs.rmSync(sourceDir, { recursive: true, force: true })
    })

    function source(file, content) {
        const target = path.join(sourceDir, file)
        fs.mkdirSync(path.dirname(target), { recursive: true })
        fs.writeFileSync(target, content)
    }

    test('discovers only called paths and methods, including wrappers and dynamic routes', () => {
        source(
            'app/calls.ts',
            `
            apiFetch('/users/kyc/plan')
            serverFetch('/identity/refresh', { method: 'POST' })
            apiFetch(\`/users/\${id}/x\`)
            apiFetch(\`/search?q=\${query}\`)
            read<Result>('/wrapped')
            read('/wrapped', { method: 'POST' })
        `
        )
        const localSpec = {
            paths: {
                '/users/kyc/plan': { get: {}, post: {} },
                '/identity/refresh': { post: {}, get: {} },
                '/users/{userId}/x': { get: {}, post: {} },
                '/search': { get: {} },
                '/wrapped': { get: {}, post: {}, delete: {} },
                '/unused': { get: {}, post: {} },
            },
        }

        expect(calledApiOperations(sourceDir, localSpec)).toEqual(
            expect.arrayContaining([
                { path: '/users/kyc/plan', method: 'get' },
                { path: '/identity/refresh', method: 'post' },
                { path: '/users/{userId}/x', method: 'get' },
                { path: '/search', method: 'get' },
                { path: '/wrapped', method: 'get' },
                { path: '/wrapped', method: 'post' },
            ])
        )
        expect(calledApiOperations(sourceDir, localSpec)).toHaveLength(6)
    })

    test('ignores references in test, dev, fixture, and type-only files', () => {
        source('app/live.tsx', "apiFetch('/live')")
        source('app/__tests__/calls.test.ts', "apiFetch('/test-only')")
        source('app/dev/calls.ts', "apiFetch('/dev-only')")
        source('app/fixtures/calls.ts', "apiFetch('/fixture-only')")
        source('app/types.d.ts', "declare function apiFetch(path: '/type-only'): void")
        const localSpec = {
            paths: {
                '/live': { get: {} },
                '/test-only': { get: {} },
                '/dev-only': { get: {} },
                '/fixture-only': { get: {} },
                '/type-only': { get: {} },
            },
        }

        expect(calledApiOperations(sourceDir, localSpec)).toEqual([{ path: '/live', method: 'get' }])
    })

    test('omits called routes that do not match the local specification', () => {
        source('app/calls.ts', "apiFetch('/missing'); apiFetch('/known')")
        expect(calledApiOperations(sourceDir, { paths: { '/known': { get: {} } } })).toEqual([
            { path: '/known', method: 'get' },
        ])
    })

    test('ignores metadata and navigation templates that are never API calls', () => {
        source('app/calls.ts', "const endpoints = ['/known']; const href = `/${locale}/${slug}`; apiFetch('/used')")
        expect(
            calledApiOperations(sourceDir, {
                paths: {
                    '/known': { get: {}, post: {} },
                    '/bridge/webhooks': { post: {} },
                    '/used': { get: {} },
                },
            })
        ).toEqual([{ path: '/used', method: 'get' }])
    })

    test('follows API wrappers and path constants while ignoring unused constants', () => {
        source(
            'app/calls.ts',
            `
            function request(path, options) { return apiFetch(path, options) }
            const endpoint = '/used'
            const unused = '/unused'
            request(endpoint, { method: 'POST' })
        `
        )
        expect(
            calledApiOperations(sourceDir, { paths: { '/used': { post: {}, get: {} }, '/unused': { get: {} } } })
        ).toEqual([{ path: '/used', method: 'post' }])
    })

    test('resolves imported route constants and route builder returns', () => {
        source(
            'app/routes.ts',
            "export const API_ROUTE='/config/kill-switches'; export function buildGraphEndpoint() { return `/invites/graph?${params}` }"
        )
        source(
            'app/calls.ts',
            "import { API_ROUTE, buildGraphEndpoint } from './routes'; apiFetch(API_ROUTE); serverFetch(buildGraphEndpoint(), {method:'GET'})"
        )
        expect(
            calledApiOperations(sourceDir, {
                paths: { '/config/kill-switches': { get: {} }, '/invites/graph': { get: {} } },
            })
        ).toEqual([
            { path: '/config/kill-switches', method: 'get' },
            { path: '/invites/graph', method: 'get' },
        ])
    })
})
