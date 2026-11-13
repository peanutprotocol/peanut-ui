jest.mock('@/utils/native-platform', () => require('@/test-utils/native-platform-mock').createNativePlatformMock())

// tests for apiFetch and serverFetch — both now call PEANUT_API_URL directly
// on every platform. The historical web→proxy fork is gone (the proxy was
// retired once peanut-api-ts/dev dropped the api-key requirement and CORS
// already allows *.peanut.me + capacitor://).

import { apiFetch, serverFetch } from '../api-fetch'
import { fetchWithSentry } from '@/utils/sentry.utils'
import { getAuthHeaders, getAuthToken } from '@/utils/auth-token'
import { isCapacitor } from '@/utils/capacitor'
import posthog from 'posthog-js'
import { enableDemoMode, disableDemoMode } from '@/utils/demo'
import { demoRespond } from '@/utils/demo-api'
import { currentAppLocale } from '@/i18n/app/locale-store'

jest.mock('@/utils/demo-api', () => ({ demoRespond: jest.fn() }))

jest.mock('@/utils/sentry.utils', () => ({
    fetchWithSentry: jest.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}) })),
}))

jest.mock('@/utils/auth-token', () => ({
    authReady: jest.fn(() => Promise.resolve()),
    getAuthToken: jest.fn(() => 'test-token'),
    getAuthHeaders: jest.fn((extra?: Record<string, string>) => ({
        Authorization: 'Bearer test-token',
        ...extra,
    })),
}))

jest.mock('@/utils/capacitor', () => ({
    isCapacitor: jest.fn(() => false),
}))

jest.mock('@capacitor/app', () => ({ App: { getInfo: jest.fn() } }))

jest.mock('@/i18n/app/locale-store', () => ({ currentAppLocale: jest.fn(() => null) }))

jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))

jest.mock('@/constants/general.consts', () => ({
    PEANUT_API_URL: 'https://api.test.com',
}))

const mockFetchWithSentry = fetchWithSentry as jest.MockedFunction<typeof fetchWithSentry>
const mockCapture = posthog.capture as jest.MockedFunction<typeof posthog.capture>

describe('apiFetch', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        disableDemoMode()
    })

    afterEach(() => {
        jest.restoreAllMocks()
        disableDemoMode()
    })

    it('intercepts web demo writes before auth headers or real network requests', async () => {
        ;(isCapacitor as jest.Mock).mockReturnValue(false)
        const synthetic = { ok: true }
        ;(demoRespond as jest.Mock).mockResolvedValue(synthetic)
        enableDemoMode()
        const options = { method: 'POST', body: JSON.stringify({ residenceCountry: 'BR' }) }
        expect(await apiFetch('/update-user', options)).toBe(synthetic)
        expect(demoRespond).toHaveBeenCalledWith('/update-user', options)
        expect(getAuthHeaders).not.toHaveBeenCalled()
        expect(mockFetchWithSentry).not.toHaveBeenCalled()
    })

    describe('url', () => {
        it('routes path to PEANUT_API_URL', async () => {
            await apiFetch('/users/me')
            expect(mockFetchWithSentry).toHaveBeenCalledWith('https://api.test.com/users/me', expect.any(Object))
        })

        it('preserves query params', async () => {
            await apiFetch('/users/history?cursor=abc&limit=10')
            expect(mockFetchWithSentry).toHaveBeenCalledWith(
                'https://api.test.com/users/history?cursor=abc&limit=10',
                expect.any(Object)
            )
        })
    })

    describe('auth headers', () => {
        it('attaches Authorization via getAuthHeaders', async () => {
            await apiFetch('/users/me')
            expect(getAuthHeaders).toHaveBeenCalled()
            const callArgs = mockFetchWithSentry.mock.calls[0][1]
            expect((callArgs?.headers as Record<string, string>)['Authorization']).toBe('Bearer test-token')
        })

        it('forwards caller-provided headers through getAuthHeaders', async () => {
            await apiFetch('/users/me', { headers: { 'X-Custom': 'value' } })
            expect(getAuthHeaders).toHaveBeenCalledWith({ 'X-Custom': 'value' })
        })

        it('can omit credentials for a public endpoint without forwarding the control option', async () => {
            await apiFetch('/fx/rate?from=PLN&to=EUR', {
                method: 'GET',
                includeAuth: false,
                credentials: 'omit',
                headers: { Accept: 'application/json' },
            })

            expect(getAuthHeaders).not.toHaveBeenCalled()
            expect(mockFetchWithSentry).toHaveBeenCalledWith(
                'https://api.test.com/fx/rate?from=PLN&to=EUR',
                expect.objectContaining({
                    method: 'GET',
                    credentials: 'omit',
                    headers: { Accept: 'application/json' },
                })
            )
            expect(mockFetchWithSentry.mock.calls[0][1]).not.toHaveProperty('includeAuth')
        })
    })

    describe('accept-language header', () => {
        const sentHeaders = () => mockFetchWithSentry.mock.calls[0][1]?.headers as Record<string, string>

        it('sends the locale the user sees so the api localizes badge copy', async () => {
            ;(currentAppLocale as jest.Mock).mockReturnValueOnce('es-AR')
            await apiFetch('/users/me')
            expect(sentHeaders()['Accept-Language']).toBe('es-AR')
        })

        it('omits it before the startup locale is applied', async () => {
            await apiFetch('/users/me')
            expect(sentHeaders()).not.toHaveProperty('Accept-Language')
        })

        it('keeps a caller-provided language', async () => {
            ;(currentAppLocale as jest.Mock).mockReturnValueOnce('pt-BR')
            await apiFetch('/users/me', { headers: { 'accept-language': 'en' } })
            expect(sentHeaders()['accept-language']).toBe('en')
            expect(sentHeaders()).not.toHaveProperty('Accept-Language')
        })
    })

    describe('content-type header', () => {
        it('adds Content-Type when body is present', async () => {
            await apiFetch('/users/me', {
                method: 'POST',
                body: JSON.stringify({ name: 'test' }),
            })

            const callArgs = mockFetchWithSentry.mock.calls[0][1]
            expect((callArgs?.headers as Record<string, string>)['Content-Type']).toBe('application/json')
        })

        it('does not add Content-Type when no body', async () => {
            await apiFetch('/users/me', { method: 'GET' })

            const callArgs = mockFetchWithSentry.mock.calls[0][1]
            expect((callArgs?.headers as Record<string, string>)['Content-Type']).toBeUndefined()
        })

        it('does not add Content-Type for a FormData body (multipart boundary is fetch-owned)', async () => {
            await apiFetch('/send-links', { method: 'POST', body: new FormData() })

            const callArgs = mockFetchWithSentry.mock.calls[0][1]
            expect((callArgs?.headers as Record<string, string>)['Content-Type']).toBeUndefined()
        })
    })

    describe('native transport preference', () => {
        const mockIsCapacitor = isCapacitor as jest.MockedFunction<typeof isCapacitor>
        const mockGetAuthToken = getAuthToken as jest.MockedFunction<typeof getAuthToken>

        it('prefers the OS transport on native when no token is readable', async () => {
            mockIsCapacitor.mockReturnValue(true)
            mockGetAuthToken.mockReturnValue(null)

            await apiFetch('/manteca/qr-payment/init', { method: 'POST', body: '{}' })

            const callArgs = mockFetchWithSentry.mock.calls[0][1] as Record<string, unknown>
            expect(callArgs.preferNativeTransport).toBe(true)
        })

        it('does not set the flag on native when a token is present', async () => {
            mockIsCapacitor.mockReturnValue(true)
            mockGetAuthToken.mockReturnValue('test-token')

            await apiFetch('/users/me')

            const callArgs = mockFetchWithSentry.mock.calls[0][1] as Record<string, unknown>
            expect(callArgs).not.toHaveProperty('preferNativeTransport')
        })

        it('does not set the flag on web even without a token', async () => {
            mockIsCapacitor.mockReturnValue(false)
            mockGetAuthToken.mockReturnValue(null)

            await apiFetch('/users/me')

            const callArgs = mockFetchWithSentry.mock.calls[0][1] as Record<string, unknown>
            expect(callArgs).not.toHaveProperty('preferNativeTransport')
        })
    })

    describe('request options passthrough', () => {
        it('passes through method and body', async () => {
            const body = JSON.stringify({ key: 'value' })

            await apiFetch('/update', {
                method: 'POST',
                body,
            })

            expect(mockFetchWithSentry).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    method: 'POST',
                    body,
                })
            )
        })
    })

    describe('idempotent passthrough', () => {
        it('forwards the idempotent flag to fetchWithSentry', async () => {
            await apiFetch('/update-user', { method: 'POST', body: '{}', idempotent: true })

            expect(mockFetchWithSentry).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({ method: 'POST', idempotent: true })
            )
        })
    })

    describe('performance telemetry', () => {
        it('captures a sampled route template with server duration', async () => {
            jest.spyOn(Math, 'random').mockReturnValueOnce(0.01)
            mockFetchWithSentry.mockResolvedValueOnce({
                ok: true,
                status: 200,
                headers: new Headers({ 'Server-Timing': 'app;dur=12.4' }),
            } as Response)

            await apiFetch('/users/alice?token=secret')

            expect(mockCapture).toHaveBeenCalledWith(
                'api_request_completed',
                expect.objectContaining({
                    route: '/users/:userId',
                    method: 'GET',
                    status_code: 200,
                    server_duration_ms: 12.4,
                    outcome: 'success',
                })
            )
            expect(JSON.stringify(mockCapture.mock.calls)).not.toContain('alice')
            expect(JSON.stringify(mockCapture.mock.calls)).not.toContain('secret')
        })

        it('captures every network failure outside the uniform sample', async () => {
            jest.spyOn(Math, 'random').mockReturnValueOnce(0.9)
            mockFetchWithSentry.mockRejectedValueOnce(new Error('private network detail'))

            await expect(apiFetch('/points/cash-status')).rejects.toThrow('private network detail')

            expect(mockCapture).toHaveBeenCalledTimes(1)
            expect(mockCapture).toHaveBeenCalledWith(
                'api_request_problem',
                expect.objectContaining({
                    route: '/points/cash-status',
                    outcome: 'network_error',
                    problem: 'network_error',
                })
            )
            expect(JSON.stringify(mockCapture.mock.calls)).not.toContain('private network detail')
        })

        it('classifies fetchWithSentry timeout errors as timeouts', async () => {
            jest.spyOn(Math, 'random').mockReturnValueOnce(0.9)
            const timeout = Object.assign(new Error('private timeout detail'), { name: 'ConnectionTimeoutError' })
            mockFetchWithSentry.mockRejectedValueOnce(timeout)

            await expect(apiFetch('/points/cash-status')).rejects.toBe(timeout)

            expect(mockCapture).toHaveBeenCalledWith(
                'api_request_problem',
                expect.objectContaining({ outcome: 'timeout', problem: 'timeout' })
            )
        })

        it('preserves a mutation response timeout and reports its unknown outcome and status', async () => {
            jest.spyOn(Math, 'random').mockReturnValueOnce(0.9)
            const unknown = Object.assign(new Error('response body stalled'), {
                name: 'MutationResponseTimeoutError',
                responseReceived: true,
                outcomeUnknown: true,
                status: 200,
            })
            mockFetchWithSentry.mockRejectedValueOnce(unknown)
            await expect(apiFetch('/charges/charge-1/payments', { method: 'POST' })).rejects.toBe(unknown)
            expect(mockCapture).toHaveBeenCalledWith(
                'api_request_problem',
                expect.objectContaining({
                    outcome: 'unknown',
                    problem: 'response_body_timeout',
                    response_received: true,
                    status_code: 200,
                })
            )
        })

        it('separates a request interrupted by an app suspension from a timeout', async () => {
            jest.spyOn(Math, 'random').mockReturnValueOnce(0.9)
            const interrupted = Object.assign(new Error('Peanut is taking too long'), {
                name: 'ConnectionTimeoutError',
                interrupted: true,
            })
            mockFetchWithSentry.mockRejectedValueOnce(interrupted)

            await expect(apiFetch('/users/me')).rejects.toBe(interrupted)

            expect(mockCapture).toHaveBeenCalledWith(
                'api_request_problem',
                expect.objectContaining({ outcome: 'interrupted', problem: 'interrupted' })
            )
        })

        it('stops sending problem events after 20 in one page load', async () => {
            jest.spyOn(Math, 'random').mockReturnValue(0.9)

            await jest.isolateModulesAsync(async () => {
                const { apiFetch: freshApiFetch } = await import('../api-fetch')
                const { default: freshPosthog } = await import('posthog-js')
                const { fetchWithSentry: freshFetch } = await import('@/utils/sentry.utils')

                for (let i = 0; i < 25; i++) {
                    ;(freshFetch as jest.Mock).mockRejectedValueOnce(new Error('offline'))
                    await expect(freshApiFetch('/points/cash-status')).rejects.toThrow('offline')
                }

                const problems = (freshPosthog.capture as jest.Mock).mock.calls.filter(
                    ([name]) => name === 'api_request_problem'
                )
                expect(problems).toHaveLength(20)
            })
        })
    })
})

describe('serverFetch', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    describe('url', () => {
        it('routes GET to PEANUT_API_URL', async () => {
            await serverFetch('/users/history', { method: 'GET' })
            expect(mockFetchWithSentry).toHaveBeenCalledWith('https://api.test.com/users/history', expect.any(Object))
        })

        it('routes POST to PEANUT_API_URL', async () => {
            await serverFetch('/invites/validate', { method: 'POST', body: JSON.stringify({}) })
            expect(mockFetchWithSentry).toHaveBeenCalledWith(
                'https://api.test.com/invites/validate',
                expect.any(Object)
            )
        })

        it('routes DELETE to PEANUT_API_URL', async () => {
            await serverFetch('/bridge/onramp/123/cancel', { method: 'DELETE' })
            expect(mockFetchWithSentry).toHaveBeenCalledWith(
                'https://api.test.com/bridge/onramp/123/cancel',
                expect.any(Object)
            )
        })

        it('preserves query params', async () => {
            await serverFetch('/users/history?cursor=abc&limit=10', { method: 'GET' })
            expect(mockFetchWithSentry).toHaveBeenCalledWith(
                'https://api.test.com/users/history?cursor=abc&limit=10',
                expect.any(Object)
            )
        })
    })

    describe('auth headers', () => {
        it('attaches Authorization via getAuthHeaders', async () => {
            await serverFetch('/users/me', { method: 'GET' })
            expect(getAuthHeaders).toHaveBeenCalled()
            const callArgs = mockFetchWithSentry.mock.calls[0][1]
            expect((callArgs?.headers as Record<string, string>)['Authorization']).toBe('Bearer test-token')
        })
    })

    describe('content-type header', () => {
        it('auto-adds Content-Type for POST with body', async () => {
            await serverFetch('/update', { method: 'POST', body: JSON.stringify({ x: 1 }) })

            const callArgs = mockFetchWithSentry.mock.calls[0][1]
            expect((callArgs?.headers as Record<string, string>)['Content-Type']).toBe('application/json')
        })

        it('does not add Content-Type for GET without body', async () => {
            await serverFetch('/data', { method: 'GET' })

            const callArgs = mockFetchWithSentry.mock.calls[0][1]
            expect((callArgs?.headers as Record<string, string>)['Content-Type']).toBeUndefined()
        })

        it('respects caller-provided Content-Type', async () => {
            await serverFetch('/upload', {
                method: 'POST',
                body: 'raw data',
                headers: { 'Content-Type': 'text/plain' },
            })

            const callArgs = mockFetchWithSentry.mock.calls[0][1]
            expect((callArgs?.headers as Record<string, string>)['Content-Type']).toBe('text/plain')
        })
    })

    describe('timeoutMs', () => {
        it('forwards timeoutMs to fetchWithSentry', async () => {
            await serverFetch('/long-running', { method: 'POST', body: '{}', timeoutMs: 60_000 })
            expect(mockFetchWithSentry).toHaveBeenCalledWith(expect.any(String), expect.any(Object), 60_000)
        })

        it('omits the third arg when timeoutMs is not set', async () => {
            await serverFetch('/quick', { method: 'GET' })
            const callArgs = mockFetchWithSentry.mock.calls[0]
            expect(callArgs.length).toBe(2)
        })
    })
})

describe('native app binary version header', () => {
    type BinaryHeaderContext = {
        apiFetch: typeof apiFetch
        serverFetch: typeof serverFetch
        fetch: jest.Mock
        binaryInfo: jest.Mock
        native: jest.Mock
        authToken: jest.Mock
    }

    // Isolate the module cache for each scenario.
    async function withBinaryHeaderContext(run: (context: BinaryHeaderContext) => Promise<void>) {
        await jest.isolateModulesAsync(async () => {
            const { App } = await import('@capacitor/app')
            const { isCapacitor: freshIsCapacitor } = await import('@/utils/capacitor')
            const { getAuthToken: freshGetAuthToken } = await import('@/utils/auth-token')
            const { fetchWithSentry: freshFetch } = await import('@/utils/sentry.utils')
            const { currentAppLocale: freshLocale } = await import('@/i18n/app/locale-store')
            const { disableDemoMode: freshDisableDemoMode } = await import('@/utils/demo')

            const binaryInfo = jest.fn()
            ;(App.getInfo as jest.Mock).mockImplementation(async () => {
                const info = await binaryInfo()
                return info && { version: info.appVersion, build: info.appBuild }
            })
            const native = freshIsCapacitor as jest.Mock
            const authToken = freshGetAuthToken as jest.Mock
            const fetch = freshFetch as jest.Mock
            binaryInfo.mockReset().mockResolvedValue({ appVersion: '1.26.0', appBuild: '456' })
            native.mockReturnValue(true)
            authToken.mockReturnValue('test-token')
            fetch.mockClear()
            ;(freshLocale as jest.Mock).mockReturnValue(null)
            freshDisableDemoMode()

            const requests = await import('../api-fetch')
            await run({ ...requests, fetch, binaryInfo, native, authToken })
        })
    }

    function binaryHeaders(fetch: jest.Mock, requestIndex = 0) {
        const headers = fetch.mock.calls[requestIndex][1].headers as Record<string, string>
        return Object.entries(headers).filter(([name]) => name.toLowerCase() === 'x-app-binary-version')
    }

    beforeEach(() => {
        jest.useFakeTimers()
    })

    afterEach(() => {
        jest.clearAllTimers()
        jest.useRealTimers()
    })

    it.each(['apiFetch', 'serverFetch'] as const)('adds the native version through %s', async (requestName) => {
        await withBinaryHeaderContext(async (context) => {
            await context[requestName]('/users/me')

            expect(binaryHeaders(context.fetch)).toEqual([['x-app-binary-version', '1.26.0']])
            expect(context.binaryInfo).toHaveBeenCalledTimes(1)
            expect(context.fetch.mock.calls[0][1]).not.toHaveProperty('preferNativeTransport')
        })
    })

    it('includes the binary version on tokenless native OS transport requests', async () => {
        await withBinaryHeaderContext(async ({ apiFetch: request, fetch, authToken }) => {
            authToken.mockReturnValue(null)

            await request('/manteca/qr-payment/init', { method: 'POST', body: '{}' })

            expect(fetch.mock.calls[0][1].preferNativeTransport).toBe(true)
            expect(binaryHeaders(fetch)).toEqual([['x-app-binary-version', '1.26.0']])
        })
    })

    it('omits automatic headers and native lookups for web and PWA requests', async () => {
        await withBinaryHeaderContext(
            async ({ apiFetch: request, serverFetch: serverRequest, fetch, binaryInfo, native }) => {
                native.mockReturnValue(false)

                await request('/users/me')
                await serverRequest('/users/history')

                expect(binaryInfo).not.toHaveBeenCalled()
                expect(binaryHeaders(fetch, 0)).toEqual([])
                expect(binaryHeaders(fetch, 1)).toEqual([])
            }
        )
    })

    it('does not attach a cached native version after switching to web', async () => {
        await withBinaryHeaderContext(
            async ({ apiFetch: request, serverFetch: serverRequest, fetch, binaryInfo, native }) => {
                await request('/users/me')
                expect(binaryHeaders(fetch, 0)).toEqual([['x-app-binary-version', '1.26.0']])

                native.mockReturnValue(false)
                await request('/users/me')
                await serverRequest('/users/history')

                expect(binaryHeaders(fetch, 1)).toEqual([])
                expect(binaryHeaders(fetch, 2)).toEqual([])
                expect(binaryInfo).toHaveBeenCalledTimes(1)
            }
        )
    })

    it.each(['x-app-binary-version', 'X-App-Binary-Version', 'X-APP-BINARY-VERSION'])(
        'preserves a caller header named %s without creating a duplicate',
        async (headerName) => {
            await withBinaryHeaderContext(async ({ apiFetch: request, serverFetch: serverRequest, fetch }) => {
                await request('/users/me', { headers: { [headerName]: '7.8.9' } })
                await serverRequest('/users/history', { headers: { [headerName]: '7.8.9' } })

                expect(binaryHeaders(fetch, 0)).toEqual([[headerName, '7.8.9']])
                expect(binaryHeaders(fetch, 1)).toEqual([[headerName, '7.8.9']])
            })
        }
    )

    it.each(['0.0.0', '9999.9999.9999', '0000.0001.0002'])(
        'accepts the exact bounded three-component version %s',
        async (appVersion) => {
            await withBinaryHeaderContext(async ({ apiFetch: request, fetch, binaryInfo }) => {
                binaryInfo.mockResolvedValue({ appVersion, appBuild: '456' })

                await request('/users/me')

                expect(binaryHeaders(fetch)).toEqual([['x-app-binary-version', appVersion]])
            })
        }
    )

    it.each([
        '',
        '1.2',
        '1.2.3.4',
        '10000.2.3',
        '1.10000.3',
        '1.2.10000',
        '1.2.3-beta',
        '1.2.3+456',
        'v1.2.3',
        ' 1.2.3',
        '1.2.3 ',
        '1.2.3\n',
        '1.2.3\r\n',
        '１.２.３',
        123,
        null,
        undefined,
    ])('omits and caches an invalid version %p', async (appVersion) => {
        await withBinaryHeaderContext(async ({ apiFetch: request, serverFetch: serverRequest, fetch, binaryInfo }) => {
            binaryInfo.mockResolvedValue({ appVersion, appBuild: '456' })

            await request('/users/me')
            await serverRequest('/users/history')

            expect(fetch).toHaveBeenCalledTimes(2)
            expect(binaryHeaders(fetch, 0)).toEqual([])
            expect(binaryHeaders(fetch, 1)).toEqual([])
            expect(binaryInfo).toHaveBeenCalledTimes(1)
        })
    })

    it.each(['null result', 'rejected lookup', 'synchronous throw'])(
        'continues requests and caches a %s without retrying',
        async (failure) => {
            await withBinaryHeaderContext(
                async ({ apiFetch: request, serverFetch: serverRequest, fetch, binaryInfo }) => {
                    if (failure === 'null result') binaryInfo.mockResolvedValue(null)
                    if (failure === 'rejected lookup')
                        binaryInfo.mockRejectedValue(new Error('native lookup unavailable'))
                    if (failure === 'synchronous throw') {
                        binaryInfo.mockImplementation(() => {
                            throw new Error('native lookup unavailable')
                        })
                    }

                    await Promise.all([request('/users/me'), serverRequest('/users/history')])
                    await request('/users/me')

                    expect(fetch).toHaveBeenCalledTimes(3)
                    for (let index = 0; index < 3; index++) expect(binaryHeaders(fetch, index)).toEqual([])
                    expect(binaryInfo).toHaveBeenCalledTimes(1)
                }
            )
        }
    )

    it('shares one in-flight lookup across both request helpers and reuses its result', async () => {
        await withBinaryHeaderContext(async ({ apiFetch: request, serverFetch: serverRequest, fetch, binaryInfo }) => {
            let resolveLookup!: (value: { appVersion: string; appBuild: string }) => void
            binaryInfo.mockReturnValue(
                new Promise((resolve) => {
                    resolveLookup = resolve
                })
            )

            const requests = [request('/users/me'), serverRequest('/users/history'), request('/users/me')]
            await jest.advanceTimersByTimeAsync(0)

            expect(binaryInfo).toHaveBeenCalledTimes(1)
            expect(fetch).not.toHaveBeenCalled()
            resolveLookup({ appVersion: '4.5.6', appBuild: '789' })
            await Promise.all(requests)
            await serverRequest('/users/history')

            expect(fetch).toHaveBeenCalledTimes(4)
            for (let index = 0; index < 4; index++) {
                expect(binaryHeaders(fetch, index)).toEqual([['x-app-binary-version', '4.5.6']])
            }
            expect(binaryInfo).toHaveBeenCalledTimes(1)
        })
    })

    it('releases concurrent requests at the 300ms bound and uses a later native result', async () => {
        await withBinaryHeaderContext(async ({ apiFetch: request, serverFetch: serverRequest, fetch, binaryInfo }) => {
            let resolveLookup!: (value: { appVersion: string; appBuild: string }) => void
            binaryInfo.mockReturnValue(
                new Promise((resolve) => {
                    resolveLookup = resolve
                })
            )

            const requests = [request('/users/me'), serverRequest('/users/history')]
            await jest.advanceTimersByTimeAsync(0)
            expect(binaryInfo).toHaveBeenCalledTimes(1)
            await jest.advanceTimersByTimeAsync(299)
            expect(fetch).not.toHaveBeenCalled()
            await jest.advanceTimersByTimeAsync(1)
            await Promise.all(requests)

            expect(fetch).toHaveBeenCalledTimes(2)
            expect(binaryHeaders(fetch, 0)).toEqual([])
            expect(binaryHeaders(fetch, 1)).toEqual([])

            resolveLookup({ appVersion: '4.5.6', appBuild: '789' })
            await jest.advanceTimersByTimeAsync(0)
            await request('/users/me')

            expect(binaryHeaders(fetch, 2)).toEqual([['x-app-binary-version', '4.5.6']])
            expect(binaryInfo).toHaveBeenCalledTimes(1)
        })
    })
})

it.each([apiFetch, serverFetch])(
    'forwards the explicit body-draining opt-out through the API client',
    async (client) => {
        jest.clearAllMocks()
        disableDemoMode()
        const options = { drainResponseBody: false, timeoutMs: 60_000 }
        await client('/users/history/export', options)
        expect(mockFetchWithSentry).toHaveBeenCalledWith(
            expect.stringContaining('/users/history/export'),
            expect.objectContaining({ drainResponseBody: false }),
            60_000
        )
    }
)
