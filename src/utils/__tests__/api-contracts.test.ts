jest.mock('@/utils/sentry-lazy', () => ({ captureMessage: jest.fn() }))
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))
jest.mock('@/constants/general.consts', () => ({ PEANUT_API_URL: 'https://api.test' }))
jest.mock('../api-fetch', () => ({
    apiFetch: (path: string, init?: RequestInit) => global.fetch(`https://api.test${path}`, init),
}))

const version = (kyc = 2) => ({
    commit: 'e7a93bf7d',
    branch: 'preview',
    builtAt: null,
    migrationsHead: null,
    contracts: { kyc },
})
const response = (status: number, body?: unknown) =>
    ({ status, ok: status === 200, json: async () => body }) as Response

describe('session API compatibility', () => {
    beforeEach(() => {
        jest.resetModules()
        delete process.env.NEXT_PUBLIC_TEST_BUILD_BRANCH
        process.env.NEXT_PUBLIC_GIT_COMMIT_HASH = 'c6d11655d'
    })
    afterEach(() => {
        jest.useRealTimers()
        delete process.env.NEXT_PUBLIC_GIT_COMMIT_HASH
        delete process.env.NEXT_PUBLIC_TEST_BUILD_BRANCH
    })

    it('shares one pending read and caches the result across callers', async () => {
        let resolve!: (value: Response) => void
        global.fetch = jest.fn(
            () =>
                new Promise<Response>((done) => {
                    resolve = done
                })
        )
        const { loadApiVersion, getApiCompatibility } = require('../api-contracts')
        const first = loadApiVersion()
        const second = loadApiVersion()
        expect(first).toBe(second)
        expect(getApiCompatibility().status).toBe('loading')
        resolve(response(200, version()))
        await first
        await loadApiVersion()
        expect(global.fetch).toHaveBeenCalledTimes(1)
        expect(getApiCompatibility()).toMatchObject({ status: 'compatible', version: version() })
    })

    it.each([0, 1])('reports kyc v%i once with both commits and no response data', async (kyc) => {
        global.fetch = jest.fn().mockResolvedValue(response(200, version(kyc)))
        const { loadApiVersion } = require('../api-contracts')
        await Promise.all([loadApiVersion(), loadApiVersion()])
        const sentry = require('@/utils/sentry-lazy')
        const posthog = require('posthog-js').default
        expect(sentry.captureMessage).toHaveBeenCalledTimes(1)
        expect(sentry.captureMessage).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({
                level: 'warning',
                extra: expect.objectContaining({ app_commit: 'c6d11655d', api_commit: 'e7a93bf7d' }),
            })
        )
        expect(posthog.capture).toHaveBeenCalledTimes(1)
    })

    it('treats a missing version endpoint as contract zero', async () => {
        global.fetch = jest.fn().mockResolvedValue(response(404))
        const { loadApiVersion, getApiCompatibility } = require('../api-contracts')
        await loadApiVersion()
        expect(getApiCompatibility()).toMatchObject({ status: 'incompatible', version: { contracts: { kyc: 0 } } })
    })

    it.each([null, {}, { ...version(), contracts: { kyc: '2' } }])(
        'keeps malformed metadata unknown: %p',
        async (body) => {
            global.fetch = jest.fn().mockResolvedValue(response(200, body))
            const { loadApiVersion, getApiCompatibility } = require('../api-contracts')
            await loadApiVersion()
            expect(getApiCompatibility().status).toBe('unknown')
        }
    )

    it('bounds an unresponsive fetch without retries and retains unknown state', async () => {
        jest.useFakeTimers()
        global.fetch = jest.fn(() => new Promise<Response>(() => {}))
        const { loadApiVersion, getApiCompatibility } = require('../api-contracts')
        const pending = loadApiVersion()
        await jest.advanceTimersByTimeAsync(5000)
        await pending
        expect(getApiCompatibility().status).toBe('unknown')
        expect(global.fetch).toHaveBeenCalledTimes(1)
    })

    it('keeps a route contract fault visible when the version read completes later', async () => {
        global.fetch = jest.fn().mockResolvedValue(response(200, version()))
        const { reportApiContractError, loadApiVersion, getApiCompatibility } = require('../api-contracts')
        reportApiContractError('/users/kyc/plan', 'GET', 'route_not_found', 404)
        await loadApiVersion()
        expect(getApiCompatibility().contractError).toBe(true)
    })

    it('does not reject or lose the mismatch when telemetry SDKs fail', async () => {
        global.fetch = jest.fn().mockResolvedValue(response(200, version(1)))
        const sentry = require('@/utils/sentry-lazy')
        const posthog = require('posthog-js').default
        sentry.captureMessage.mockImplementation(() => {
            throw new Error('Sentry unavailable')
        })
        posthog.capture.mockImplementation(() => {
            throw new Error('PostHog unavailable')
        })
        const { loadApiVersion, getApiCompatibility } = require('../api-contracts')
        await expect(loadApiVersion()).resolves.toBeUndefined()
        expect(getApiCompatibility().status).toBe('incompatible')
        expect(posthog.capture).toHaveBeenCalledTimes(1)
    })

    it('times out a stalled JSON body and ignores a late version response', async () => {
        jest.useFakeTimers()
        let complete!: (value: unknown) => void
        global.fetch = jest.fn().mockResolvedValue({
            status: 200,
            ok: true,
            json: () =>
                new Promise((resolve) => {
                    complete = resolve
                }),
        })
        const { loadApiVersion, getApiCompatibility } = require('../api-contracts')
        const pending = loadApiVersion()
        await jest.advanceTimersByTimeAsync(5000)
        await pending
        complete(version(1))
        await Promise.resolve()
        expect(getApiCompatibility().status).toBe('unknown')
    })
})
