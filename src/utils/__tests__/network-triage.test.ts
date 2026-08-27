import {
    captureNetworkTriagedFailure,
    isNativeFetchRejection,
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

// url → resolve or reject, so each probe's outcome is scripted independently
function mockProbes({ api, internet }: { api: boolean; internet: boolean }) {
    global.fetch = jest.fn((input: RequestInfo | URL) => {
        const url = String(input)
        const ok = url.includes('api.peanut.me') ? api : internet
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

describe('triageNetworkFailure', () => {
    test('returns null for a non-network error without probing', async () => {
        mockProbes({ api: true, internet: true })
        expect(await triageNetworkFailure(new Error('insufficient balance'))).toBeNull()
        expect(global.fetch).not.toHaveBeenCalled()
    })

    test('api probe succeeding means the failure was NOT connectivity', async () => {
        mockProbes({ api: true, internet: true })
        const triage = await triageNetworkFailure(fetchRejection)
        expect(triage?.verdict).toBe('api_reachable')
    })

    test('internet up but edge down → edge_unreachable', async () => {
        mockProbes({ api: false, internet: true })
        const triage = await triageNetworkFailure(fetchRejection)
        expect(triage?.verdict).toBe('edge_unreachable')
    })

    test('nothing reachable → offline', async () => {
        mockProbes({ api: false, internet: false })
        const triage = await triageNetworkFailure(fetchRejection)
        expect(triage?.verdict).toBe('offline')
    })

    test('also triages fetchWithSentry-wrapped failures by their rethrown name', async () => {
        mockProbes({ api: true, internet: true })
        const triage = await triageNetworkFailure(wrappedRejection)
        expect(triage?.verdict).toBe('api_reachable')
    })

    test('probes with no-cors so an opaque (even non-2xx) response still counts as reachable', async () => {
        mockProbes({ api: true, internet: true })
        await triageNetworkFailure(fetchRejection)
        const calls = (global.fetch as jest.Mock).mock.calls
        expect(calls.length).toBe(2)
        for (const [, init] of calls) {
            expect(init).toMatchObject({ method: 'HEAD', mode: 'no-cors', cache: 'no-store' })
        }
    })
})

describe('networkTriageTags', () => {
    test('flattens the triage for use as Sentry tags / analytics props', () => {
        expect(networkTriageTags({ verdict: 'api_reachable', online: true, effectiveType: '4g', probeMs: 12 })).toEqual(
            { net_triage: 'api_reachable', net_online: 'true', net_effective_type: '4g' }
        )
    })

    test('is empty when triage was inapplicable', () => {
        expect(networkTriageTags(null)).toEqual({})
    })
})

describe('captureNetworkTriagedFailure', () => {
    test('rides the verdict on BOTH the Sentry event and the analytics event', async () => {
        mockProbes({ api: true, internet: true })
        await captureNetworkTriagedFailure(fetchRejection, {
            tags: { critical_flow: 'send-link', send_link_step: 'create' },
            extra: { amount: '9' },
            analytics: { event: 'send_link_failed', props: { error_name: 'TypeError' } },
        })
        expect(posthog.capture).toHaveBeenCalledWith(
            'send_link_failed',
            expect.objectContaining({ error_name: 'TypeError', net_triage: 'api_reachable' })
        )
        expect(captureException).toHaveBeenCalledWith(fetchRejection, {
            tags: expect.objectContaining({
                critical_flow: 'send-link',
                send_link_step: 'create',
                net_triage: 'api_reachable',
            }),
            extra: { amount: '9' },
        })
    })

    test('still reports untriaged errors, without triage tags', async () => {
        mockProbes({ api: true, internet: true })
        const err = new Error('insufficient balance')
        await captureNetworkTriagedFailure(err, { tags: { critical_flow: 'send-link' } })
        expect(captureException).toHaveBeenCalledWith(err, {
            tags: { critical_flow: 'send-link' },
            extra: undefined,
        })
        expect(posthog.capture).not.toHaveBeenCalled()
    })
})
