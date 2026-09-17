/**
 * The mandatory-update policy contract: exactly mono's public schema, a
 * verdict per platform group against CLIENT_GENERATION, and a remembered
 * block that survives a failed or malformed live read — while a remembered
 * "supported" never admits anything on its own.
 */
import { CLIENT_GENERATION, CLIENT_SUPPORT_POLICY_STORAGE_KEY } from '@/constants/client-support.consts'

const platform = { current: 'web' as ReturnType<typeof import('@/utils/capacitor').getPlatform>, capacitor: false }
jest.mock('@/utils/capacitor', () => ({
    getPlatform: () => platform.current,
    getApiBaseUrl: () => (platform.capacitor ? 'https://peanut.me' : ''),
}))
const fixture = { name: null as string | null }
jest.mock('@/dev/fixtures/active', () => ({ ensureActiveFixture: () => fixture.name }))

import {
    checkClientSupport,
    clientPlatform,
    clientSupportPolicyUrl,
    evaluateClientSupport,
    fetchClientSupportPolicy,
    parseClientSupportPolicy,
    readStoredClientSupportPolicy,
    resolveClientSupport,
    storeClientSupportPolicy,
    type ClientSupportPolicy,
} from '../client-support'

const ZERO: ClientSupportPolicy = { schemaVersion: 1, minimumGeneration: { web: 0, ios: 0, android: 0 } }
const policyWith = (floors: Partial<ClientSupportPolicy['minimumGeneration']>): ClientSupportPolicy => ({
    schemaVersion: 1,
    minimumGeneration: { ...ZERO.minimumGeneration, ...floors },
})

const fetchMock = jest.fn()
const respond = (body: unknown, ok = true) =>
    fetchMock.mockResolvedValue({ ok, json: async () => body } as unknown as Response)

beforeEach(() => {
    jest.useFakeTimers()
    window.localStorage.clear()
    platform.current = 'web'
    platform.capacitor = false
    fixture.name = null
    fetchMock.mockReset()
    global.fetch = fetchMock as unknown as typeof fetch
})

afterEach(() => {
    jest.useRealTimers()
})

describe('parseClientSupportPolicy', () => {
    it('accepts exactly the public schema', () => {
        expect(
            parseClientSupportPolicy({ schemaVersion: 1, minimumGeneration: { web: 0, ios: 3, android: 1 } })
        ).toEqual(policyWith({ ios: 3, android: 1 }))
    })

    it.each([
        ['null', null],
        ['array', []],
        ['schema 2', { schemaVersion: 2, minimumGeneration: ZERO.minimumGeneration }],
        ['extra top-level key', { ...ZERO, releases: [] }],
        ['missing platform', { schemaVersion: 1, minimumGeneration: { web: 0, ios: 0 } }],
        ['extra platform', { schemaVersion: 1, minimumGeneration: { ...ZERO.minimumGeneration, desktop: 0 } }],
        ['negative floor', { schemaVersion: 1, minimumGeneration: { web: -1, ios: 0, android: 0 } }],
        ['fractional floor', { schemaVersion: 1, minimumGeneration: { web: 1.5, ios: 0, android: 0 } }],
        ['string floor', { schemaVersion: 1, minimumGeneration: { web: '1', ios: 0, android: 0 } }],
        ['unsafe integer', { schemaVersion: 1, minimumGeneration: { web: 2 ** 53, ios: 0, android: 0 } }],
    ])('rejects %s', (_label, value) => {
        expect(parseClientSupportPolicy(value)).toBeNull()
    })
})

describe('platform groups', () => {
    it.each([
        ['web', 'web'],
        ['ios-pwa', 'web'],
        ['android-pwa', 'web'],
        ['ios-native', 'ios'],
        ['android-native', 'android'],
    ] as const)('%s reads the %s floor', (running, group) => {
        expect(clientPlatform(running)).toBe(group)
    })
})

describe('evaluateClientSupport', () => {
    it('is groundwork: the zero policy requires nothing on any platform', () => {
        for (const group of ['web', 'ios', 'android'] as const) {
            expect(evaluateClientSupport(ZERO, group)).toBe('supported')
        }
    })

    it('supports a client at the floor and blocks one below it, per platform', () => {
        const policy = policyWith({ ios: CLIENT_GENERATION + 1, android: CLIENT_GENERATION })
        expect(evaluateClientSupport(policy, 'web')).toBe('supported')
        expect(evaluateClientSupport(policy, 'android')).toBe('supported')
        expect(evaluateClientSupport(policy, 'ios')).toBe('unsupported')
    })

    it('judges the generation, never a release hash or shell version', () => {
        expect(evaluateClientSupport(policyWith({ web: 3 }), 'web', 3)).toBe('supported')
        expect(evaluateClientSupport(policyWith({ web: 3 }), 'web', 2)).toBe('unsupported')
    })
})

describe('resolveClientSupport', () => {
    it('lets a valid live policy decide, even when it lifts a remembered block', () => {
        expect(resolveClientSupport(ZERO, policyWith({ web: 99 }), 'web')).toMatchObject({
            status: 'supported',
            source: 'live',
        })
    })

    it('keeps a remembered block when the live read failed', () => {
        expect(resolveClientSupport(null, policyWith({ web: 99 }), 'web')).toMatchObject({
            status: 'unsupported',
            source: 'cached',
        })
    })

    it('has no verdict with nothing live and nothing remembered', () => {
        expect(resolveClientSupport(null, null, 'web')).toEqual({ status: 'unavailable', policy: null, source: 'none' })
    })

    it('does not admit on a remembered "supported": an old floor is not current authorization', () => {
        expect(resolveClientSupport(null, ZERO, 'web')).toEqual({ status: 'unavailable', policy: null, source: 'none' })
    })

    it('keeps a remembered block only for the platform it blocks', () => {
        expect(resolveClientSupport(null, policyWith({ ios: 99 }), 'web').status).toBe('unavailable')
        expect(resolveClientSupport(null, policyWith({ ios: 99 }), 'ios').status).toBe('unsupported')
    })
})

describe('remembered policy', () => {
    it('round-trips through storage', () => {
        storeClientSupportPolicy(policyWith({ android: 2 }))
        expect(readStoredClientSupportPolicy()).toEqual(policyWith({ android: 2 }))
    })

    it.each([
        ['garbage', 'not json'],
        ['wrong shape', JSON.stringify({ schemaVersion: 1 })],
        ['tampered floor', JSON.stringify({ schemaVersion: 1, minimumGeneration: { web: -5, ios: 0, android: 0 } })],
    ])('treats a %s stored value as nothing remembered', (_label, raw) => {
        window.localStorage.setItem(CLIENT_SUPPORT_POLICY_STORAGE_KEY, raw)
        expect(readStoredClientSupportPolicy()).toBeNull()
    })
})

describe('fetchClientSupportPolicy', () => {
    it('reads the policy same-origin on the web, uncached and without credentials', async () => {
        respond(ZERO)
        await expect(fetchClientSupportPolicy()).resolves.toEqual(ZERO)
        expect(fetchMock).toHaveBeenCalledWith(
            '/client-support.json',
            expect.objectContaining({ cache: 'no-store', credentials: 'omit' })
        )
    })

    it('reads the web origin from native', () => {
        platform.capacitor = true
        expect(clientSupportPolicyUrl()).toBe('https://peanut.me/client-support.json')
    })

    it.each([
        ['a non-2xx response', () => respond(ZERO, false)],
        ['a malformed body', () => respond({ schemaVersion: 1 })],
        [
            'unparseable JSON',
            () =>
                fetchMock.mockResolvedValue({
                    ok: true,
                    json: async () => {
                        throw new SyntaxError()
                    },
                }),
        ],
        ['a network failure', () => fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))],
    ])('answers null on %s', async (_label, arrange) => {
        arrange()
        await expect(fetchClientSupportPolicy()).resolves.toBeNull()
    })

    it('gives up after the timeout instead of holding the wallet tree', async () => {
        fetchMock.mockImplementation(
            (_url: string, init: RequestInit) =>
                new Promise((_resolve, reject) => {
                    init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
                })
        )
        const pending = fetchClientSupportPolicy()
        await jest.advanceTimersByTimeAsync(5_000)
        await expect(pending).resolves.toBeNull()
    })
})

describe('checkClientSupport', () => {
    it('remembers a valid live policy for the next launch', async () => {
        respond(policyWith({ ios: 2 }))
        await expect(checkClientSupport(null, 'web')).resolves.toMatchObject({ status: 'supported', source: 'live' })
        expect(readStoredClientSupportPolicy()).toEqual(policyWith({ ios: 2 }))
    })

    it('falls back to the in-memory policy when storage kept nothing', async () => {
        fetchMock.mockRejectedValue(new TypeError('offline'))
        await expect(checkClientSupport(policyWith({ web: 99 }), 'web')).resolves.toMatchObject({
            status: 'unsupported',
            source: 'cached',
        })
    })

    it('never clears a remembered block on a malformed live policy', async () => {
        storeClientSupportPolicy(policyWith({ web: 99 }))
        respond({ schemaVersion: 1, minimumGeneration: { web: 0 } })
        await expect(checkClientSupport(null, 'web')).resolves.toMatchObject({
            status: 'unsupported',
            source: 'cached',
        })
        expect(readStoredClientSupportPolicy()).toEqual(policyWith({ web: 99 }))
    })
})

describe('dev fixtures', () => {
    // DEV_TOOLS_ENABLED is a build-time constant; the fixture path only exists
    // behind it, so the module is reloaded with the constant forced on.
    function loadWithDevTools() {
        jest.resetModules()
        jest.doMock('@/constants/dev-tools.consts', () => ({ DEV_TOOLS_ENABLED: true }))
        return require('../client-support') as typeof import('../client-support')
    }

    it('answers from the registry entry instead of the network', async () => {
        fixture.name = 'update-required'
        const { fetchClientSupportPolicy: fetchPolicy } = loadWithDevTools()
        await expect(fetchPolicy()).resolves.toEqual(policyWith({ web: 99, ios: 99, android: 99 }))
        expect(fetchMock).not.toHaveBeenCalled()
    })

    it('fails the read when the fixture lists the policy under fails', async () => {
        fixture.name = 'update-check-failed'
        const { fetchClientSupportPolicy: fetchPolicy } = loadWithDevTools()
        await expect(fetchPolicy()).resolves.toBeNull()
        expect(fetchMock).not.toHaveBeenCalled()
    })

    it('reads the real file for a fixture that says nothing about the policy', async () => {
        fixture.name = 'home'
        respond(ZERO)
        const { fetchClientSupportPolicy: fetchPolicy } = loadWithDevTools()
        await expect(fetchPolicy()).resolves.toEqual(ZERO)
        expect(fetchMock).toHaveBeenCalledTimes(1)
    })
})
