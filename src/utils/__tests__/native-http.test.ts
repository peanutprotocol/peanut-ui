/**
 * @jest-environment node
 */
// node env: native-http builds real Response/Headers objects, which are
// natively present in Node but stripped by jsdom.
import { canUseNativeHttp, nativeHttpRequest } from '@/utils/native-http'
import { isCapacitor } from '@/utils/capacitor'

jest.mock('@/constants/general.consts', () => ({
    PEANUT_API_URL: 'https://api.test.com',
}))

jest.mock('@/utils/capacitor', () => ({
    isCapacitor: jest.fn(() => true),
}))

const mockRequest = jest.fn()
jest.mock('@capacitor/core', () => ({
    CapacitorHttp: { request: (...args: unknown[]) => mockRequest(...args) },
}))

const mockIsCapacitor = isCapacitor as jest.MockedFunction<typeof isCapacitor>

describe('canUseNativeHttp', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockIsCapacitor.mockReturnValue(true)
    })

    it('is true for API URLs with string or no body on native', () => {
        expect(canUseNativeHttp('https://api.test.com/users/me')).toBe(true)
        expect(canUseNativeHttp('https://api.test.com/charges', { method: 'POST', body: '{}' })).toBe(true)
    })

    it('is false on web', () => {
        mockIsCapacitor.mockReturnValue(false)
        expect(canUseNativeHttp('https://api.test.com/users/me')).toBe(false)
    })

    it('is false for non-API URLs', () => {
        expect(canUseNativeHttp('https://example.com/thing')).toBe(false)
    })

    it('is false for non-string bodies (multipart keeps the WebView path)', () => {
        expect(canUseNativeHttp('https://api.test.com/upload', { method: 'POST', body: new FormData() })).toBe(false)
    })
})

describe('nativeHttpRequest', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('maps a text response onto a standard Response', async () => {
        mockRequest.mockResolvedValue({
            status: 200,
            data: '{"ok":true}',
            headers: { 'content-type': 'application/json' },
        })
        const res = await nativeHttpRequest('https://api.test.com/healthz', { method: 'GET' }, 5000)
        expect(res.status).toBe(200)
        expect(await res.json()).toEqual({ ok: true })
    })

    it('stringifies object data (plugin may parse JSON despite responseType text)', async () => {
        mockRequest.mockResolvedValue({ status: 200, data: { ok: true }, headers: {} })
        const res = await nativeHttpRequest('https://api.test.com/healthz', {}, 5000)
        expect(await res.json()).toEqual({ ok: true })
    })

    it('passes method, headers, body, and timeouts to the plugin', async () => {
        mockRequest.mockResolvedValue({ status: 201, data: '', headers: {} })
        await nativeHttpRequest(
            'https://api.test.com/charges',
            { method: 'POST', headers: { Authorization: 'Bearer t', 'Content-Type': 'application/json' }, body: '{}' },
            7000
        )
        expect(mockRequest).toHaveBeenCalledWith({
            url: 'https://api.test.com/charges',
            method: 'POST',
            headers: { authorization: 'Bearer t', 'content-type': 'application/json' },
            data: '{}',
            connectTimeout: 7000,
            readTimeout: 7000,
            responseType: 'text',
        })
    })

    it('returns a null body for 204 (Response() would throw otherwise)', async () => {
        mockRequest.mockResolvedValue({ status: 204, data: '', headers: {} })
        const res = await nativeHttpRequest('https://api.test.com/thing', { method: 'DELETE' }, 5000)
        expect(res.status).toBe(204)
        expect(await res.text()).toBe('')
    })

    /*
     * `connectTimeout`/`readTimeout` are PHASE limits, and Android's read limit
     * resets on every chunk — so the two options the test above forwards bound a
     * slow request at 2x and a slow drip not at all. The wall-clock race is what
     * makes the shared budget in fetchWithSentry true on the mobile app, where
     * the bounded call is the POST that creates a real Manteca price lock. It is
     * mocked out of sentry-prefer-native.test.ts, so without these two cases it
     * could be deleted with every other test in the repo still green.
     */
    it('rejects at the budget when the plugin never settles', async () => {
        mockRequest.mockReturnValue(new Promise(() => {}))

        const started = Date.now()
        await expect(
            nativeHttpRequest('https://api.test.com/manteca/qr-payment/init', { method: 'POST' }, 50)
        ).rejects.toMatchObject({
            // fetchWithSentry classifies on the name: anything else is reported
            // as an opaque transport failure rather than the timeout it is.
            name: 'AbortError',
        })
        expect(Date.now() - started).toBeLessThan(1_000)
    })

    it('resolves normally when the plugin answers inside the budget', async () => {
        mockRequest.mockResolvedValue({ status: 200, data: '{"ok":true}', headers: {} })

        const res = await nativeHttpRequest('https://api.test.com/healthz', { method: 'GET' }, 5_000)

        expect(res.status).toBe(200)
        await expect(res.json()).resolves.toEqual({ ok: true })
    })

    it('throws when the plugin reports no status', async () => {
        mockRequest.mockResolvedValue({ status: 0, data: '', headers: {} })
        await expect(nativeHttpRequest('https://api.test.com/healthz', {}, 5000)).rejects.toThrow(TypeError)
    })
})
