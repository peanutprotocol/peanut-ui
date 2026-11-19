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
    const plan = { available: true, routes: [], entry }
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
