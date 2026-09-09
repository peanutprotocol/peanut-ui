/** @jest-environment jsdom */
/**
 * The scan budget reaches the wire through two hops that no test covered:
 * `initiateQrPayment`'s optional spread, then `callApi`'s destructure into
 * `fetchWithSentry`'s third positional argument. Drop either and every page
 * test stays green while the call silently reverts to the 20s default — the
 * till wait this halved would be back with no signal. Same failure mode the
 * `http.method` tag is guarded against in sentry.utils.test.ts.
 */
import { mantecaApi } from '@/services/manteca'
import { serverFetch } from '@/utils/api-fetch'
import { MANTECA_QR_INIT_SCAN_TIMEOUT_MS } from '@/constants/manteca.consts'

jest.mock('@/utils/api-fetch', () => ({ apiFetch: jest.fn(), serverFetch: jest.fn() }))

const mockServerFetch = serverFetch as jest.MockedFunction<typeof serverFetch>

const okResponse = (body: unknown) => ({ ok: true, status: 200, json: async () => body }) as unknown as Response

const errorResponse = (status: number, body: unknown) =>
    ({ ok: false, status, statusText: 'Error', json: async () => body }) as unknown as Response

describe('mantecaApi.initiateQrPayment — scan timeout forwarding', () => {
    beforeEach(() => jest.clearAllMocks())

    /*
     * The literal value, not just that it is forwarded. The tests below would
     * pass just as well against the 20s default, so nothing pinned the number
     * the constant's own comment argues for from measured latency (p99 6.59s,
     * 0.073% of requests over 10s). Raising it is a deliberate policy change
     * and should have to edit this line.
     */
    it('is the measured 10s scan budget', () => {
        expect(MANTECA_QR_INIT_SCAN_TIMEOUT_MS).toBe(10_000)
    })

    it('forwards the scan budget, the path and the body to serverFetch', async () => {
        mockServerFetch.mockResolvedValue(okResponse({ code: 'LOCK1' }))

        await mantecaApi.initiateQrPayment(
            { qrCode: '00020101', qrType: 'ARGENTINA_QR3' },
            { timeoutMs: MANTECA_QR_INIT_SCAN_TIMEOUT_MS }
        )

        expect(mockServerFetch).toHaveBeenCalledWith(
            '/manteca/qr-payment/init',
            expect.objectContaining({
                method: 'POST',
                body: JSON.stringify({ qrCode: '00020101', qrType: 'ARGENTINA_QR3' }),
                timeoutMs: MANTECA_QR_INIT_SCAN_TIMEOUT_MS,
            })
        )
    })

    // The option is optional, and omitting it must not send `timeoutMs:
    // undefined` — that would override the caller-visible default with nothing.
    it('sends no timeoutMs at all when the caller passes none', async () => {
        mockServerFetch.mockResolvedValue(okResponse({ code: 'LOCK1' }))

        await mantecaApi.initiateQrPayment({ qrCode: '00020101' })

        expect(mockServerFetch.mock.calls[0][1]).not.toHaveProperty('timeoutMs')
    })

    /*
     * The idempotency key is what makes retrying this POST safe: the backend
     * replays the price lock it already created rather than minting a second
     * one at Manteca. Dropping it from the body would restore the orphaned-lock
     * behaviour with every page test still green.
     */
    it('forwards the idempotency key in the body', async () => {
        mockServerFetch.mockResolvedValue(okResponse({ code: 'LOCK1' }))

        await mantecaApi.initiateQrPayment({ qrCode: '00020101', idempotencyKey: 'scan-key-1' })

        expect(JSON.parse(String(mockServerFetch.mock.calls[0][1]?.body))).toMatchObject({
            idempotencyKey: 'scan-key-1',
        })
    })
})

/*
 * The construction itself, not a hand-built fixture.
 *
 * Retry gating and the copy mapping both key off the `code` this branch
 * attaches. Every other suite builds its own `Object.assign(new Error(...), {
 * name: 'ApiError', code })`, so regressing this throw to a plain Error — or
 * dropping `code` — would restore four POSTs and generic copy for a
 * KYC-blocked user while the whole repo stayed green.
 */
describe('mantecaApi.initiateQrPayment — error construction', () => {
    beforeEach(() => jest.clearAllMocks())

    it('preserves name, status, message and code on a reworded rejection', async () => {
        mockServerFetch.mockResolvedValue(
            errorResponse(400, { error: 'some entirely reworded sentence', code: 'MANTECA_KYC_REQUIRED' })
        )

        const thrown = await mantecaApi.initiateQrPayment({ qrCode: '00020101' }).catch((e) => e)

        expect(thrown).toBeInstanceOf(Error)
        expect(thrown.name).toBe('ApiError')
        expect(thrown.status).toBe(400)
        expect(thrown.message).toBe('some entirely reworded sentence')
        expect(thrown.code).toBe('MANTECA_KYC_REQUIRED')
    })

    /*
     * The 422s put the code in `error`, which becomes `message`. The
     * classifier's legacy fallback reads it from there for API builds that
     * predate the `code` field, so the message must stay the bare code.
     */
    it('keeps the bare code as the message for the legacy 422 shape', async () => {
        mockServerFetch.mockResolvedValue(errorResponse(422, { error: 'MANTECA_SOURCE_OVER_MONTHLY_CAP' }))

        const thrown = await mantecaApi.initiateQrPayment({ qrCode: '00020101' }).catch((e) => e)

        expect(thrown.message).toBe('MANTECA_SOURCE_OVER_MONTHLY_CAP')
        expect(thrown.status).toBe(422)
        expect(thrown.code).toBeUndefined()
    })

    it('survives an unreadable error body', async () => {
        mockServerFetch.mockResolvedValue({
            ok: false,
            status: 502,
            statusText: 'Bad Gateway',
            json: async () => {
                throw new Error('not json')
            },
        } as unknown as Response)

        const thrown = await mantecaApi.initiateQrPayment({ qrCode: '00020101' }).catch((e) => e)

        expect(thrown.name).toBe('ApiError')
        expect(thrown.status).toBe(502)
    })
})
