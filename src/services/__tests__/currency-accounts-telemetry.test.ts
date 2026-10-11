/**
 * U14: EURC money requests reach API telemetry under their own low-cardinality
 * route templates instead of '/unmatched', and the templates never carry an
 * operation id or signed bytes.
 */
import posthog from 'posthog-js'
import { fetchWithSentry } from '@/utils/sentry.utils'
import { currencyAccountsApi } from '@/services/currency-accounts'
import { apiRouteTemplate } from '@/utils/performance-analytics'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'

jest.mock('@/utils/sentry.utils', () => ({ fetchWithSentry: jest.fn() }))
jest.mock('@/utils/auth-token', () => ({
    authReady: jest.fn(() => Promise.resolve()),
    getAuthToken: jest.fn(() => 'test-token'),
    getAuthHeaders: jest.fn((extra?: Record<string, string>) => ({ Authorization: 'Bearer test-token', ...extra })),
}))
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))

const OPERATION_ID = '6f1c2a4e-7b3d-4c1a-9e2f-0123456789ab'
const SIGNATURE = `0x${'ab'.repeat(65)}`
const SIGNED_OPERATION = {
    sender: `0x${'12'.repeat(20)}`,
    nonce: '0x7',
    callData: `0xa9059cbb${'00'.repeat(64)}`,
    signature: SIGNATURE,
}
const BASE = '/users/currency-accounts/EURC'

const unavailable = () =>
    ({
        ok: false,
        status: 503,
        headers: { get: () => null },
        json: async () => ({ error: 'currency_service_unavailable' }),
        text: async () => JSON.stringify({ error: 'currency_service_unavailable' }),
    }) as unknown as Response

beforeEach(() => {
    jest.mocked(posthog.capture).mockClear()
    jest.mocked(fetchWithSentry).mockReset()
    jest.mocked(fetchWithSentry).mockImplementation(async () => unavailable())
})

it('tracks prepare, submit and resume under distinct EURC route templates without the operation id or signed bytes', async () => {
    await expect(
        currencyAccountsApi.prepare({
            requestKey: OPERATION_ID,
            kind: 'SEND',
            sourceAsset: 'EURC',
            amount: '1.5',
            recipient: `0x${'22'.repeat(20)}`,
        })
    ).rejects.toThrow()
    await expect(currencyAccountsApi.submit(OPERATION_ID, SIGNED_OPERATION)).rejects.toThrow()
    await expect(currencyAccountsApi.resume(OPERATION_ID)).rejects.toThrow()

    const problems = jest
        .mocked(posthog.capture)
        .mock.calls.filter(([event]) => event === ANALYTICS_EVENTS.API_REQUEST_PROBLEM)
        .map(([, properties]) => properties as { route: string; method: string })
    expect(problems.map(({ method, route }) => `${method} ${route}`)).toEqual([
        `POST ${BASE}/operations`,
        `POST ${BASE}/operations/:operationId/submit`,
        `POST ${BASE}/operations/:operationId/resume`,
    ])

    const captured = JSON.stringify(jest.mocked(posthog.capture).mock.calls)
    expect(captured).not.toContain(OPERATION_ID)
    expect(captured).not.toContain(SIGNATURE.slice(2, 42))
})

it.each([
    ['/users/currency-accounts', '/users/currency-accounts'],
    [`${BASE}/capabilities`, `${BASE}/capabilities`],
    [`${BASE}/history`, `${BASE}/history`],
    [`${BASE}/history?cursor=2026-10-01T00:00:00.000Z::${OPERATION_ID}`, `${BASE}/history`],
    [`${BASE}/bank-accounts`, `${BASE}/bank-accounts`],
    [`${BASE}/exchange-rate?from=USDC`, `${BASE}/exchange-rate`],
    [`${BASE}/operations`, `${BASE}/operations`],
    [`${BASE}/operations/${OPERATION_ID}`, `${BASE}/operations/:operationId`],
    [`${BASE}/operations/${OPERATION_ID}/submit`, `${BASE}/operations/:operationId/submit`],
    [`${BASE}/operations/${OPERATION_ID}/resume`, `${BASE}/operations/:operationId/resume`],
])('templates %s as %s', (path, template) => {
    expect(apiRouteTemplate(path)).toBe(template)
})
