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

    it('throws when the plugin reports no status', async () => {
        mockRequest.mockResolvedValue({ status: 0, data: '', headers: {} })
        await expect(nativeHttpRequest('https://api.test.com/healthz', {}, 5000)).rejects.toThrow(TypeError)
    })
})
