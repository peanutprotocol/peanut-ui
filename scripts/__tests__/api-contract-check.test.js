const { checkApiContracts } = require('../api-contract-check')

const apiUrl = 'https://api.example.test'
const version = (...values) => ({
    commit: null,
    branch: null,
    builtAt: null,
    migrationsHead: null,
    contracts: { kyc: values.length ? values[0] : 3 },
})
const openapi = (paths = { '/users/kyc/plan': { get: {} } }) => ({ openapi: '3.0.0', paths })
const response = (status, body) => ({
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
})
const logger = () => ({ log: jest.fn(), warn: jest.fn(), error: jest.fn(), info: jest.fn() })
const fetchFor = (versionResult, openapiResult = response(200, openapi())) =>
    jest.fn(async (url) => {
        if (String(url).endsWith('/version'))
            return typeof versionResult === 'function' ? versionResult() : versionResult
        if (String(url).endsWith('/openapi.json'))
            return typeof openapiResult === 'function' ? openapiResult() : openapiResult
        throw new Error(`Unexpected URL: ${url}`)
    })
const options = (fetchImpl, overrides = {}) => ({ apiUrl, fetchImpl, logger: logger(), ...overrides })
const messages = (mock) => mock.mock.calls.flat().map(String).join(' ')

describe('native API contract preflight', () => {
    test.each([3, 4])('accepts compatible kyc contract version %i and required operation', async (kyc) => {
        const fetchImpl = fetchFor(response(200, version(kyc)))
        await checkApiContracts(options(fetchImpl))
        expect(fetchImpl.mock.calls.map(([url]) => String(url))).toEqual(
            expect.arrayContaining([`${apiUrl}/version`, `${apiUrl}/openapi.json`])
        )
    })

    test('normalizes a trailing slash in the API URL', async () => {
        const fetchImpl = fetchFor(response(200, version()))
        await checkApiContracts(options(fetchImpl, { apiUrl: `${apiUrl}/` }))
        expect(fetchImpl.mock.calls.map(([url]) => String(url))).toEqual(
            expect.arrayContaining([`${apiUrl}/version`, `${apiUrl}/openapi.json`])
        )
    })

    test.each([0, 1, 2, -1, 1.5, '3', null, undefined])(
        'rejects invalid or insufficient kyc contract %p in test builds',
        async (kyc) => {
            await expect(checkApiContracts(options(fetchFor(response(200, version(kyc)))))).rejects.toThrow(/kyc/i)
        }
    )

    test('rejects missing contracts in test builds', async () => {
        await expect(
            checkApiContracts(options(fetchFor(response(200, { ...version(), contracts: {} }))))
        ).rejects.toThrow(/kyc/i)
    })

    test('treats a version 404 as kyc contract zero', async () => {
        await expect(checkApiContracts(options(fetchFor(response(404))))).rejects.toThrow(/kyc/i)
    })

    test.each([
        ['server error', response(500)],
        ['malformed version', response(200, null)],
        [
            'malformed JSON',
            () => ({
                status: 200,
                ok: true,
                json: async () => {
                    throw new SyntaxError('invalid JSON')
                },
            }),
        ],
        [
            'network error',
            () => {
                throw new Error('network unavailable')
            },
        ],
    ])('fails closed when version cannot be verified: %s', async (_name, result) => {
        await expect(checkApiContracts(options(fetchFor(result)))).rejects.toThrow()
    })

    test.each([
        ['version 404', response(404)],
        ['old contract', response(200, version(1))],
        ['invalid contract', response(200, version('2'))],
        ['version error', response(500)],
        ['malformed version', response(200, null)],
        [
            'network error',
            () => {
                throw new Error('network unavailable')
            },
        ],
    ])('warns instead of failing production for %s', async (_name, result) => {
        const log = logger()
        await checkApiContracts(options(fetchFor(result), { production: true, logger: log }))
        expect(log.warn).toHaveBeenCalled()
    })

    test('rejects a missing required path and identifies the operation', async () => {
        const fetchImpl = fetchFor(response(200, version()), response(200, openapi({})))
        await expect(checkApiContracts(options(fetchImpl))).rejects.toThrow(/\/users\/kyc\/plan/i)
    })

    test('rejects a missing required method even when the path exists', async () => {
        const fetchImpl = fetchFor(
            response(200, version()),
            response(200, openapi({ '/users/kyc/plan': { post: {} } }))
        )
        await expect(checkApiContracts(options(fetchImpl))).rejects.toThrow(/get/i)
    })

    test('checks only explicitly supplied operations', async () => {
        const requiredOperations = [{ path: '/custom', method: 'post' }]
        const fetchImpl = fetchFor(response(200, version()), response(200, openapi({ '/custom': { post: {} } })))
        await checkApiContracts(options(fetchImpl, { requiredOperations }))
    })

    test('warns and skips operation verification when OpenAPI returns 404', async () => {
        const log = logger()
        await checkApiContracts(options(fetchFor(response(200, version()), response(404)), { logger: log }))
        expect(log.warn).toHaveBeenCalled()
    })

    test.each([
        ['server error', response(500)],
        ['malformed document', response(200, null)],
        [
            'malformed JSON',
            () => ({
                status: 200,
                ok: true,
                json: async () => {
                    throw new SyntaxError('invalid JSON')
                },
            }),
        ],
        [
            'network error',
            () => {
                throw new Error('network unavailable')
            },
        ],
    ])('fails closed on unknown OpenAPI state: %s', async (_name, result) => {
        await expect(checkApiContracts(options(fetchFor(response(200, version()), result)))).rejects.toThrow()
    })

    test.each([
        ['server error', response(500)],
        ['malformed document', response(200, null)],
        ['missing operation', response(200, openapi({}))],
    ])('warns in production for OpenAPI %s', async (_name, result) => {
        const log = logger()
        await checkApiContracts(options(fetchFor(response(200, version()), result), { production: true, logger: log }))
        expect(log.warn).toHaveBeenCalled()
    })

    test('explicit skip makes no requests and logs that checks were skipped', async () => {
        const fetchImpl = jest.fn()
        const log = logger()
        await checkApiContracts(options(fetchImpl, { skip: true, logger: log }))
        expect(fetchImpl).not.toHaveBeenCalled()
        expect([messages(log.log), messages(log.warn), messages(log.info)].join(' ')).toMatch(/skip/i)
    })

    test('times out even if fetch never settles', async () => {
        jest.useFakeTimers()
        try {
            const fetchImpl = jest.fn(() => new Promise(() => {}))
            const result = checkApiContracts(options(fetchImpl, { timeoutMs: 100 }))
            const assertion = expect(result).rejects.toThrow(/tim(e|ed)\s*out|timeout/i)
            await jest.advanceTimersByTimeAsync(100)
            await assertion
        } finally {
            jest.useRealTimers()
        }
    })
})
