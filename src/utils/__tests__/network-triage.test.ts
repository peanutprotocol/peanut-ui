import {
    captureNetworkTriagedFailure,
    isNativeFetchRejection,
    isNetworkLayerFailure,
    networkTriageTags,
    triageNetworkFailure,
} from '../network-triage'
import { captureException } from '@sentry/nextjs'
import posthog from 'posthog-js'

jest.mock('@sentry/nextjs', () => ({ captureException: jest.fn() }))
jest.mock('posthog-js', () => ({ capture: jest.fn() }))
jest.mock('@/constants/general.consts', () => ({ PEANUT_API_URL: 'https://api.peanut.me' }))

const fetchRejection = new TypeError('Failed to fetch')
const wrappedRejection = Object.assign(new Error('Something went wrong. Please try again.'), {
    name: 'ServiceUnavailableError',
})

// (url, mode) → resolve or reject, so each of the three probes is scripted
// independently. `apiCors` and `apiNoCors` are separate because the pair is
// the whole discriminator: a WAF challenge or CORS-less error page answers the
// no-cors probe while failing the cors one.
function mockProbes({
    apiCors,
    apiNoCors = apiCors,
    internet,
}: {
    apiCors: boolean
    apiNoCors?: boolean
    internet: boolean
}) {
    global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const isApi = String(input).includes('api.peanut.me')
        const ok = isApi ? (init?.mode === 'cors' ? apiCors : apiNoCors) : internet
        return ok ? Promise.resolve({} as Response) : Promise.reject(new TypeError('Failed to fetch'))
    }) as jest.Mock
}

afterEach(() => {
    jest.clearAllMocks()
})

describe('isNativeFetchRejection', () => {
    test.each(['Failed to fetch', 'Load failed', 'NetworkError when attempting to fetch resource.'])(
        'matches TypeError with engine message %p',
        (message) => {
            expect(isNativeFetchRejection('TypeError', message)).toBe(true)
        }
    )

    test('rejects our own wrapped copy that merely contains the engine string', () => {
        expect(isNativeFetchRejection('Error', 'Failed to fetch charges: 500')).toBe(false)
        expect(isNativeFetchRejection('TypeError', 'Failed to fetch charges: 500')).toBe(false)
        expect(isNativeFetchRejection(undefined, undefined)).toBe(false)
    })
})

// The predicate the qr-pay / withdraw catches use to report selectively: their
// other branches are deliberate non-reports (backend wire codes, user actions),
// so they need to single out the network class without capturing everything.
describe('isNetworkLayerFailure', () => {
    test.each([
        ['a raw engine rejection', new TypeError('Failed to fetch')],
        ['a fetchWithSentry timeout', Object.assign(new Error('slow'), { name: 'ConnectionTimeoutError' })],
        ['a fetchWithSentry generic wrap', Object.assign(new Error('nope'), { name: 'ServiceUnavailableError' })],
    ])('accepts %s', (_label, error) => {
        expect(isNetworkLayerFailure(error)).toBe(true)
    })

    test.each([
        ['a server decision', Object.assign(new Error('insufficient collateral'), { name: 'ApiError' })],
        ['our own wrapped fetch copy', new Error('Failed to fetch charges: 500')],
        ['a non-Error throw', 'something odd'],
    ])('rejects %s', (_label, error) => {
        expect(isNetworkLayerFailure(error)).toBe(false)
    })
})

describe('triageNetworkFailure', () => {
    test('returns null for a non-network error without probing', async () => {
        mockProbes({ apiCors: true, internet: true })
        expect(await triageNetworkFailure(new Error('insufficient balance'))).toBeNull()
        expect(global.fetch).not.toHaveBeenCalled()
    })

    test('api probe succeeding is recorded as an observation, with the error class alongside', async () => {
        mockProbes({ apiCors: true, internet: true })
        const triage = await triageNetworkFailure(fetchRejection)
        expect(triage?.observed).toBe('api_reachable')
        expect(triage?.errorClass).toBe('fetch_rejection')
    })

    test('internet up but edge down → edge_unreachable', async () => {
        mockProbes({ apiCors: false, internet: true })
        const triage = await triageNetworkFailure(fetchRejection)
        expect(triage?.observed).toBe('edge_unreachable')
    })

    // The failure mode this whole diagnostic exists to find: a WAF challenge
    // or CORS-less error page completes the transaction (no-cors resolves) but
    // carries no CORS headers (cors rejects).
    test('something answered but unreadably → api_cors_blocked, not edge_unreachable', async () => {
        mockProbes({ apiCors: false, apiNoCors: true, internet: true })
        const triage = await triageNetworkFailure(fetchRejection)
        expect(triage?.observed).toBe('api_cors_blocked')
    })

    // CORP is enforced on no-cors requests only, so the cors probe still sees
    // a healthy edge while /healthz serves same-site (until api-ts#1456
    // deploys) and the native origin https://localhost is cross-site. Without
    // the cors probe this exact case mislabels a healthy edge as unreachable.
    test('a CORP-blocked no-cors probe still reports api_reachable via the cors probe', async () => {
        mockProbes({ apiCors: true, apiNoCors: false, internet: true })
        const triage = await triageNetworkFailure(fetchRejection)
        expect(triage?.observed).toBe('api_reachable')
    })

    test('nothing reachable → offline', async () => {
        mockProbes({ apiCors: false, internet: false })
        const triage = await triageNetworkFailure(fetchRejection)
        expect(triage?.observed).toBe('offline')
    })

    test('also triages fetchWithSentry-wrapped failures by their rethrown name', async () => {
        mockProbes({ apiCors: true, internet: true })
        const triage = await triageNetworkFailure(wrappedRejection)
        expect(triage?.observed).toBe('api_reachable')
        expect(triage?.errorClass).toBe('service_unavailable')
    })

    test('a timeout carries its own error class so api_reachable cannot read as CORS evidence', async () => {
        mockProbes({ apiCors: true, internet: true })
        const timeout = Object.assign(new Error('Peanut is taking too long to respond'), {
            name: 'ConnectionTimeoutError',
        })
        const triage = await triageNetworkFailure(timeout)
        expect(triage?.errorClass).toBe('timeout')
    })

    test('fires both API probe modes plus the neutral internet probe', async () => {
        mockProbes({ apiCors: true, internet: true })
        await triageNetworkFailure(fetchRejection)
        const calls = (global.fetch as jest.Mock).mock.calls as [string, RequestInit][]
        expect(calls).toHaveLength(3)
        for (const [, init] of calls) {
            expect(init).toMatchObject({ method: 'HEAD', cache: 'no-store' })
        }
        const shape = calls.map(([url, init]) => `${url.includes('api.peanut.me') ? 'api' : 'internet'}:${init.mode}`)
        expect(shape.sort()).toEqual(['api:cors', 'api:no-cors', 'internet:no-cors'])
    })
})

describe('networkTriageTags', () => {
    test('flattens the triage for use as Sentry tags / analytics props', () => {
        expect(
            networkTriageTags({
                observed: 'api_reachable',
                errorClass: 'fetch_rejection',
                online: true,
                effectiveType: '4g',
                probeMs: 12,
            })
        ).toEqual({
            net_probe: 'api_reachable',
            net_error_class: 'fetch_rejection',
            net_online: 'true',
            net_effective_type: '4g',
        })
    })

    test('is empty when triage was inapplicable', () => {
        expect(networkTriageTags(null)).toEqual({})
    })
})

describe('captureNetworkTriagedFailure', () => {
    test('rides the observation on BOTH the Sentry event and the analytics event', async () => {
        mockProbes({ apiCors: true, internet: true })
        await captureNetworkTriagedFailure(fetchRejection, {
            tags: { critical_flow: 'send-link', send_link_step: 'create' },
            extra: { amount: '9' },
            analytics: { event: 'send_link_failed', props: { error_name: 'TypeError' } },
        })
        expect(posthog.capture).toHaveBeenCalledWith(
            'send_link_failed',
            expect.objectContaining({
                error_name: 'TypeError',
                net_probe: 'api_reachable',
                net_error_class: 'fetch_rejection',
                net_probe_ms: expect.any(Number),
            })
        )
        expect(captureException).toHaveBeenCalledWith(fetchRejection, {
            tags: expect.objectContaining({
                critical_flow: 'send-link',
                send_link_step: 'create',
                net_probe: 'api_reachable',
                net_error_class: 'fetch_rejection',
            }),
            extra: { amount: '9', net_probe_ms: expect.any(Number) },
        })
    })

    test('still reports untriaged errors, without triage tags', async () => {
        mockProbes({ apiCors: true, internet: true })
        const err = new Error('insufficient balance')
        await captureNetworkTriagedFailure(err, { tags: { critical_flow: 'send-link' } })
        expect(captureException).toHaveBeenCalledWith(err, {
            tags: { critical_flow: 'send-link' },
            extra: undefined,
        })
        expect(posthog.capture).not.toHaveBeenCalled()
    })
})
