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
})
