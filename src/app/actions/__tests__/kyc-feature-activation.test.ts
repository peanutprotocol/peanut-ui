import { activateKycFeature } from '@/app/actions/kyc-feature-activation'
import { serverFetch } from '@/utils/api-fetch'

jest.mock('@/utils/api-fetch', () => ({ serverFetch: jest.fn() }))

const fetchMock = serverFetch as jest.Mock
const response = (status: number, body: unknown) => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
})

describe('activateKycFeature public contract', () => {
    beforeEach(() => jest.clearAllMocks())

    it.each(['qr', 'local', 'bank', 'card'] as const)(
        'activates %s using the private v2 API contract',
        async (feature) => {
            const report = { state: 'on' }
            fetchMock.mockResolvedValueOnce(response(200, report))

            await expect(activateKycFeature(feature)).resolves.toEqual({ kind: 'report', report })
            expect(fetchMock).toHaveBeenCalledTimes(1)
            expect(fetchMock).toHaveBeenCalledWith(`/users/kyc/features/${feature}/activate`, {
                method: 'POST',
                headers: { 'x-kyc-client': '2' },
                cache: 'no-store',
                redactTelemetry: true,
            })
        }
    )

    it.each(['ready', 'on', 'setting_up', 'pending', 'action_required', 'refused', 'not_requested'])(
        'preserves the API report state %s without promoting it to activation success',
        async (state) => {
            const report = { state }
            fetchMock.mockResolvedValueOnce(response(200, report))
            await expect(activateKycFeature('bank')).resolves.toEqual({ kind: 'report', report })
        }
    )

    it.each(['supplement:bridge', 'supplement:manteca', 'supplement:rain', 'activate'])(
        'preserves the reported action %s',
        async (action) => {
            const report = { state: 'action_required', action }
            fetchMock.mockResolvedValueOnce(response(200, report))
            await expect(activateKycFeature('bank')).resolves.toEqual({ kind: 'report', report })
        }
    )

    it.each(['identity_document_insufficient', 'requirements_uncollectable', 'residence_unknown'])(
        'preserves the reported refusal reason %s',
        async (reason) => {
            const report = { state: 'refused', reason }
            fetchMock.mockResolvedValueOnce(response(200, report))
            await expect(activateKycFeature('bank')).resolves.toEqual({ kind: 'report', report })
        }
    )

    it.each([
        null,
        undefined,
        {},
        [],
        'on',
        { state: 'approved' },
        { state: 1 },
        { state: 'on', action: null },
        { state: 'on', action: 1 },
        { state: 'on', action: {} },
        { state: 'on', reason: null },
        { state: 'on', reason: false },
        { state: 'on', reason: [] },
    ])('fails closed for malformed 200 report %p', async (body) => {
        fetchMock.mockResolvedValueOnce(response(200, body))
        await expect(activateKycFeature('bank')).resolves.toEqual({ kind: 'failed' })
    })

    it.each([201, 202, 204])('does not accept HTTP %s as the required 200 report', async (status) => {
        fetchMock.mockResolvedValueOnce(response(status, { state: 'on' }))
        await expect(activateKycFeature('bank')).resolves.toEqual({ kind: 'failed' })
    })

    it.each(['identity_not_approved', 'feature_not_open', 'questions_missing'] as const)(
        'returns the recognized 409 conflict %s',
        async (code) => {
            fetchMock.mockResolvedValueOnce(response(409, { code }))

            await expect(activateKycFeature('bank')).resolves.toEqual({ kind: 'conflict', code })
            expect(fetchMock).toHaveBeenCalledTimes(1)
        }
    )

    it('preserves the questions_missing step', async () => {
        fetchMock.mockResolvedValueOnce(response(409, { code: 'questions_missing', step: 'occupation' }))

        await expect(activateKycFeature('bank')).resolves.toEqual({
            kind: 'conflict',
            code: 'questions_missing',
            step: 'occupation',
        })
    })

    it.each([null, {}, [], 'questions_missing', { code: 'unknown' }, { code: 409 }])(
        'fails closed for an unrecognized conflict body: %p',
        async (body) => {
            fetchMock.mockResolvedValueOnce(response(409, body))
            await expect(activateKycFeature('bank')).resolves.toEqual({ kind: 'failed' })
        }
    )

    it.each([400, 401, 403, 404, 429, 500, 502, 503])('does not treat HTTP %s as success', async (status) => {
        fetchMock.mockResolvedValueOnce(response(status, { code: 'questions_missing' }))
        await expect(activateKycFeature('qr')).resolves.toEqual({ kind: 'failed' })
        expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('returns failed when the request rejects, without retrying', async () => {
        fetchMock.mockRejectedValueOnce(new Error('network unavailable'))
        await expect(activateKycFeature('local')).resolves.toEqual({ kind: 'failed' })
        expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('returns failed when JSON decoding rejects', async () => {
        fetchMock.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: async () => {
                throw new Error('invalid JSON')
            },
        })
        await expect(activateKycFeature('card')).resolves.toEqual({ kind: 'failed' })
    })

    it.each([undefined, null, '', 'identity', 'BANK', '../bank', 'qr/activate', 1, {}, []])(
        'rejects invalid runtime feature %p before any API request',
        async (feature) => {
            await expect(activateKycFeature(feature as Parameters<typeof activateKycFeature>[0])).resolves.toEqual({
                kind: 'failed',
            })
            expect(fetchMock).not.toHaveBeenCalled()
        }
    )
})
