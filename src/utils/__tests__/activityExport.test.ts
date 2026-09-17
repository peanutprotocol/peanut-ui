import { prepareActivityExport, saveActivityExport } from '../activityExport.utils'
import { serverFetch } from '../api-fetch'
import { isCapacitor } from '../capacitor'
import { CapacitorHttp } from '@capacitor/core'
import { downloadBlob } from '@/components/Card/share-asset/captureShareAsset'

jest.mock('../api-fetch', () => ({ serverFetch: jest.fn() }))
jest.mock('../capacitor', () => ({ isCapacitor: jest.fn() }))
jest.mock('../auth-token', () => ({
    authReady: jest.fn().mockResolvedValue(undefined),
    getAuthHeaders: () => ({ Authorization: 'Bearer owner-token' }),
}))
jest.mock('@/constants/general.consts', () => ({ PEANUT_API_URL: 'https://api.example.test' }))
jest.mock('@capacitor/core', () => ({ CapacitorHttp: { request: jest.fn() } }))
jest.mock('@/components/Card/share-asset/captureShareAsset', () => ({ downloadBlob: jest.fn() }))
const fetchMock = serverFetch as jest.Mock
const native = isCapacitor as jest.Mock

beforeEach(() => {
    jest.clearAllMocks()
    native.mockReturnValue(false)
})

describe('activity downloads', () => {
    it('fetches private bytes through the authenticated client with telemetry redacted', async () => {
        fetchMock.mockResolvedValue({
            ok: true,
            headers: {
                get: (name: string) =>
                    name === 'content-type' ? 'application/pdf' : 'attachment; filename="activity.pdf"',
            },
            blob: async () => new Blob(['%PDF'], { type: 'application/pdf' }),
        })
        const prepared = await prepareActivityExport({
            format: 'pdf',
            fromIso: '2026-08-01T00:00:00.000Z',
            toIso: '2026-08-31T23:59:59.999Z',
        })
        expect(fetchMock).toHaveBeenCalledWith(
            expect.stringContaining('format=pdf&timeZone='),
            expect.objectContaining({ redactTelemetry: true, cache: 'no-store' })
        )
        expect(new URLSearchParams(fetchMock.mock.calls[0][0].split('?')[1]).get('to')).toBe('2026-09-01T00:00:00.000Z')
        expect(prepared.fileName).toBe('activity.pdf')
        expect(downloadBlob).not.toHaveBeenCalled()
        expect(await saveActivityExport(prepared)).toBe('saved')
        expect(downloadBlob).toHaveBeenCalledWith(prepared.blob, 'activity.pdf')
    })
    it('keeps server validation failures out of downloaded files', async () => {
        fetchMock.mockResolvedValue({ ok: false, json: async () => ({ code: 'EXPORT_UNVERIFIED' }) })
        await expect(prepareActivityExport({ format: 'xlsx' })).rejects.toThrow('EXPORT_UNVERIFIED')
        expect(downloadBlob).not.toHaveBeenCalled()
    })
    it('fetches native XLSX as a binary with owner auth', async () => {
        native.mockReturnValue(true)
        ;(CapacitorHttp.request as jest.Mock).mockResolvedValue({
            status: 200,
            data: btoa('PK workbook'),
            headers: { 'Content-Disposition': 'attachment; filename="activity.xlsx"' },
        })
        const file = await prepareActivityExport({ format: 'xlsx' })
        expect(CapacitorHttp.request).toHaveBeenCalledWith(
            expect.objectContaining({ responseType: 'arraybuffer', headers: { Authorization: 'Bearer owner-token' } })
        )
        expect(file.blob.type).toContain('spreadsheetml.sheet')
        expect(file.fileName).toBe('activity.xlsx')
        expect(downloadBlob).not.toHaveBeenCalled()
    })
    it('does not claim success when the native share sheet is cancelled', async () => {
        native.mockReturnValue(true)
        Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true })
        Object.defineProperty(navigator, 'share', {
            configurable: true,
            value: jest.fn().mockRejectedValue(new DOMException('Cancelled', 'AbortError')),
        })
        expect(await saveActivityExport({ blob: new Blob(['file']), fileName: 'activity.csv' })).toBe('cancelled')
        expect(downloadBlob).not.toHaveBeenCalled()
    })
    it('fails explicitly when native cannot save, rather than silently using an unsupported anchor', async () => {
        native.mockReturnValue(true)
        Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => false })
        await expect(saveActivityExport({ blob: new Blob(['file']), fileName: 'activity.csv' })).rejects.toThrow(
            'EXPORT_SAVE_UNAVAILABLE'
        )
    })
})
