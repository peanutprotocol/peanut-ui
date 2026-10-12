import { apiFetch } from '@/utils/api-fetch'
import { apiErrorStatus, wireErrorCode } from '@/services/api-error'
import { moneriumApi } from '../monerium'

jest.mock('@/utils/api-fetch', () => ({ apiFetch: jest.fn() }))

const BASE = '/users/currency-accounts/EURE'
const OPERATION_ID = '6f1c2a4e-7b3d-4c1a-9e2f-0123456789ab'
const SIGNATURE = `0x${'ab'.repeat(65)}`
const REQUEST_KEY = '0b0f7e0e-4a3c-4e16-8d1c-5f5a1d9b2c11'

const reply = (status: number, body: unknown) =>
    ({
        ok: status >= 200 && status < 300,
        status,
        headers: { get: () => null },
        json: async () => body,
        text: async () => JSON.stringify(body),
    }) as unknown as Response

const lastRequest = () => {
    const [path, options] = jest.mocked(apiFetch).mock.calls.at(-1)!
    const init = (options ?? {}) as RequestInit
    return {
        path,
        method: (init.method ?? 'GET').toUpperCase(),
        body: typeof init.body === 'string' ? JSON.parse(init.body) : undefined,
    }
}

const ANSWERS = { occupation: 'OCCUPATION_EMPLOYED', tin: '123456789', usCitizen: false }

const requests: Array<[string, () => Promise<unknown>, string, string, unknown?]> = [
    ['onboarding()', () => moneriumApi.onboarding(), 'GET', `${BASE}/onboarding`, undefined],
    ['share()', () => moneriumApi.share(), 'POST', `${BASE}/onboarding/share`, undefined],
    ['submitForm(answers)', () => moneriumApi.submitForm(ANSWERS), 'POST', `${BASE}/onboarding/form`, ANSWERS],
    ['linkMessage()', () => moneriumApi.linkMessage(), 'GET', `${BASE}/onboarding/link-message`, undefined],
    [
        'link(signature)',
        () => moneriumApi.link(SIGNATURE as `0x${string}`),
        'POST',
        `${BASE}/onboarding/link`,
        { signature: SIGNATURE },
    ],
    ['requestIban()', () => moneriumApi.requestIban(), 'POST', `${BASE}/onboarding/iban`, undefined],
    ['capabilities()', () => moneriumApi.capabilities(), 'GET', `${BASE}/capabilities`, undefined],
    [
        'prepareWithdraw(input)',
        () => moneriumApi.prepareWithdraw({ requestKey: REQUEST_KEY, amount: '10.00', externalAccountId: 'iban-1' }),
        'POST',
        `${BASE}/operations`,
        { requestKey: REQUEST_KEY, kind: 'BANK_WITHDRAW', amount: '10.00', externalAccountId: 'iban-1' },
    ],
    [
        'submitWithdraw(id, signature)',
        () => moneriumApi.submitWithdraw(OPERATION_ID, SIGNATURE as `0x${string}`),
        'POST',
        `${BASE}/operations/${OPERATION_ID}/submit`,
        { signature: SIGNATURE },
    ],
    [
        'operation(id)',
        () => moneriumApi.operation(OPERATION_ID),
        'GET',
        `${BASE}/operations/${OPERATION_ID}`,
        undefined,
    ],
    ['history()', () => moneriumApi.history(), 'GET', `${BASE}/history`, undefined],
    ['history(cursor)', () => moneriumApi.history('abc123'), 'GET', `${BASE}/history?cursor=abc123`, undefined],
]

beforeEach(() => {
    jest.mocked(apiFetch).mockReset()
})

describe('moneriumApi requests', () => {
    it.each(requests)('%s sends the right method, path and body', async (_name, call, method, path, body) => {
        jest.mocked(apiFetch).mockResolvedValue(reply(200, { ok: true }))
        await call()
        expect(jest.mocked(apiFetch)).toHaveBeenCalledTimes(1)
        const request = lastRequest()
        expect(request.method).toBe(method)
        expect(request.path).toBe(path)
        if (body === undefined) expect(request.body).toBeUndefined()
        else expect(request.body).toEqual(body)
    })

    it.each(requests)('%s resolves with the parsed response body', async (_name, call) => {
        const payload = { state: 'SHARING', nextStep: 'share', iban: null, reason: null }
        jest.mocked(apiFetch).mockResolvedValue(reply(200, payload))
        await expect(call()).resolves.toEqual(payload)
    })
})

describe('moneriumApi errors', () => {
    it.each([
        'verification_required',
        'kyc_sharing_unavailable',
        'monerium_unavailable',
        'monerium_refused',
        'invalid_form',
        'invalid_state',
        'invalid_signature',
        'wallet_missing',
        'wallet_not_deployed',
        'address_linked_elsewhere',
        'link_required',
        'onboarding_incomplete',
        'invalid_amount',
        'amount_below_minimum',
        'supporting_document_required',
        'idempotency_conflict',
        'invalid_bank_account',
        'operation_in_flight',
        'insufficient_balance',
        'operation_not_found',
        'operation_expired',
        'operation_already_submitted',
    ])('surfaces the wire code %s from an { error } response', async (code) => {
        jest.mocked(apiFetch).mockResolvedValue(reply(409, { error: code }))
        const failure = await moneriumApi.share().then(
            () => null,
            (error: unknown) => error
        )
        expect(failure).not.toBeNull()
        expect(wireErrorCode(failure)).toBe(code)
    })

    it('keeps the HTTP status next to the wire code', async () => {
        jest.mocked(apiFetch).mockResolvedValue(reply(503, { error: 'kyc_sharing_unavailable' }))
        const failure = await moneriumApi.share().then(
            () => null,
            (error: unknown) => error
        )
        expect(apiErrorStatus(failure)).toBe(503)
    })

    it('rejects every method on a failed response, not only share', async () => {
        jest.mocked(apiFetch).mockResolvedValue(reply(409, { error: 'operation_in_flight' }))
        const failures = await Promise.all(
            requests.map(([, call]) =>
                call().then(
                    () => null,
                    (error: unknown) => wireErrorCode(error)
                )
            )
        )
        expect(failures).toEqual(requests.map(() => 'operation_in_flight'))
    })

    it('rejects with the network error untouched when no response arrives', async () => {
        const lost = new TypeError('Failed to fetch')
        jest.mocked(apiFetch).mockRejectedValue(lost)
        await expect(
            moneriumApi.prepareWithdraw({ requestKey: REQUEST_KEY, amount: '1.00', externalAccountId: 'x' })
        ).rejects.toBe(lost)
    })
})
