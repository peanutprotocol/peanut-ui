import { activateKycFeature } from '../kyc-feature-activation'
import { startFeatureReverification } from '../kyc-reverification'
import { getKycDocumentPlan, getKycDocumentStatus, refreshKycIdentityStatus } from '../kyc-workflow'
import { serverFetch } from '@/utils/api-fetch'
import { featureReverificationPath, safeReverificationReturnTo } from '@/utils/kyc-reverification'

jest.mock('@/utils/api-fetch', () => ({ serverFetch: jest.fn() }))

const fetch = jest.mocked(serverFetch)
const entry = {
    kind: 'reverify_for_feature',
    feature: 'bank',
    targetProvider: 'BRIDGE',
    attemptId: 'candidate',
} as const
const key = 'e343de28-9e01-4246-ad97-74180e007cdd'
const response = (status: number, body: unknown) => ({ status, ok: status < 400, json: async () => body }) as Response

beforeEach(() => fetch.mockReset())

it('reads the feature plan with v3 and preserves the entry alongside the old fields', async () => {
    const plan = { available: true, flow: null, routes: [], entry }
    fetch.mockResolvedValueOnce(response(200, plan))
    await expect(getKycDocumentPlan(false, undefined, 'bank')).resolves.toEqual(plan)
    expect(fetch).toHaveBeenCalledWith(
        '/users/kyc/plan?feature=bank',
        expect.objectContaining({
            headers: { 'x-kyc-client': '3' },
        })
    )
})

it('keeps the 409 entry and display fields through the activation transport', async () => {
    const conflict = {
        code: 'feature_reverification_required',
        entry,
        userMessage: 'Verify again',
        message: 'Verify again',
        error: 'Verify again',
    }
    fetch.mockResolvedValueOnce(response(409, conflict))
    await expect(activateKycFeature('bank')).resolves.toEqual({ kind: 'conflict', ...conflict })
})

it('starts with the requested feature and accepts the server-owned active target', async () => {
    const active = { attemptId: entry.attemptId, status: 'COLLECTING', entry }
    fetch.mockResolvedValueOnce(response(200, active))
    await expect(startFeatureReverification('card', key)).resolves.toEqual(active)
    expect(fetch).toHaveBeenCalledWith(
        '/users/kyc/reverification',
        expect.objectContaining({
            method: 'POST',
            headers: { 'x-kyc-client': '3' },
            body: JSON.stringify({ feature: 'card', requestKey: key }),
        })
    )
})

it('rejects inconsistent start and entry IDs', async () => {
    fetch.mockResolvedValueOnce(response(200, { attemptId: 'another-attempt', status: 'COLLECTING', entry }))
    await expect(startFeatureReverification('bank', key)).resolves.toEqual({ error: '' })
})

it.each([
    ['COLLECTING', 'NOT_STARTED', null],
    ['COLLECTING', 'ACTION_REQUIRED', '2026-11-18T12:00:00.000Z'],
    ['IN_REVIEW', 'IN_REVIEW', null],
    ['REJECTED', 'REJECTED', null],
    ['APPROVED', 'APPROVED', null],
])(
    'reads %s for the candidate even when a canonical APPROVED row and unrelated identity are present',
    async (status, expected, reviewedAt) => {
        fetch.mockResolvedValueOnce(
            response(200, {
                identity: { canonicalStatus: 'APPROVED' },
                attempts: [
                    { id: 'old', kind: 'IDENTITY', status: 'APPROVED' },
                    { id: entry.attemptId, kind: 'IDENTITY', status, reviewedAt },
                ],
            })
        )
        await expect(getKycDocumentStatus(undefined, entry.attemptId)).resolves.toBe(expected)
    }
)

it('ignores a canonical APPROVED refresh response and refuses to infer success when the candidate is absent', async () => {
    fetch.mockResolvedValueOnce(response(200, { status: 'APPROVED' }))
    fetch.mockResolvedValueOnce(response(200, { identity: { canonicalStatus: 'APPROVED' }, attempts: [] }))
    await expect(refreshKycIdentityStatus(entry.attemptId)).resolves.toBeUndefined()
    expect(fetch).toHaveBeenCalledWith(
        `/users/kyc/identity/refresh?attemptId=${encodeURIComponent(entry.attemptId)}`,
        expect.objectContaining({ method: 'POST' })
    )
})

it.each([
    null,
    '',
    'https://evil.test',
    '//evil.test',
    '/\\evil.test',
    '/\n/evil.test',
    '/.//evil.test',
    '/%2e//evil.test',
    '/verify?feature=bank',
    '/'.repeat(4097),
])('rejects an invalid or recursive return destination %j', (destination) =>
    expect(safeReverificationReturnTo(destination)).toBeNull()
)

it('preserves the original internal path, query and fragment', () => {
    const destination = '/withdraw/bank?currency=EUR&method=SEPA#amount'
    const params = new URL(featureReverificationPath(entry, destination), 'https://peanut.test').searchParams
    expect(Object.fromEntries(params)).toEqual({
        mode: 'reverify',
        feature: 'bank',
        returnTo: destination,
        targetProvider: 'BRIDGE',
    })
})

it('removes consumed Sumsub reload state from the return destination', () => {
    expect(safeReverificationReturnTo('/withdraw/bank?kyc=resume&currency=EUR#amount')).toBe(
        '/withdraw/bank?currency=EUR#amount'
    )
})

it.each([
    [
        409,
        {
            code: 'reverification_not_required',
            userMessage: 'Already verified',
            message: 'Secondary',
            error: 'Tertiary',
        },
        'Already verified',
    ],
    [409, { code: 'feature_not_open', message: 'Feature unavailable', error: 'Tertiary' }, 'Feature unavailable'],
    [
        409,
        { code: 'reverification_finished', outcome: 'REJECTED', error: 'Verification finished' },
        'Verification finished',
    ],
    [409, { code: 'kyc_client_update_required', userMessage: 'Update the app' }, 'Update the app'],
    [403, { code: 'forbidden', message: 'Access denied' }, 'Access denied'],
])('preserves start refusal code and display copy for HTTP %s', async (status, body, error) => {
    fetch.mockResolvedValueOnce(response(status, body))
    await expect(startFeatureReverification('bank', key)).resolves.toMatchObject({
        status,
        code: body.code,
        error,
        ...('outcome' in body ? { outcome: body.outcome } : {}),
    })
})

it('preserves the Retry-After header on an unavailable start', async () => {
    fetch.mockResolvedValueOnce({
        ...response(503, { code: 'temporarily_unavailable', userMessage: 'Try again soon' }),
        headers: { get: (name: string) => (name.toLowerCase() === 'retry-after' ? '2' : null) },
    } as Response)
    await expect(startFeatureReverification('bank', key)).resolves.toMatchObject({
        status: 503,
        code: 'temporarily_unavailable',
        error: 'Try again soon',
        retryAfter: '2',
    })
})

it('returns the uncertain request fallback when the start request fails', async () => {
    fetch.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    await expect(startFeatureReverification('bank', key)).resolves.toEqual({ error: '' })
})

it('treats a collecting candidate with a retry request as action required', async () => {
    fetch.mockResolvedValueOnce(
        response(200, {
            identity: { canonicalStatus: 'APPROVED' },
            attempts: [
                {
                    id: entry.attemptId,
                    kind: 'IDENTITY',
                    status: 'COLLECTING',
                    reviewedAt: null,
                    retryRequestedAt: '2026-11-18T12:00:00.000Z',
                },
            ],
        })
    )
    await expect(getKycDocumentStatus(undefined, entry.attemptId)).resolves.toBe('ACTION_REQUIRED')
})
