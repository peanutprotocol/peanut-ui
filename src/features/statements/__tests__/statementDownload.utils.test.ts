import { downloadFailure, prepareStatement, saveStatement } from '../statementDownload.utils'
import { serverFetch } from '@/utils/api-fetch'
import { isCapacitor } from '@/utils/capacitor'
import { CapacitorHttp } from '@capacitor/core'
import { downloadBlob } from '@/components/Card/share-asset/captureShareAsset'

jest.mock('@/utils/api-fetch', () => ({ serverFetch: jest.fn() }))
jest.mock('@/utils/capacitor', () => ({ isCapacitor: jest.fn() }))
jest.mock('@/utils/auth-token', () => ({
    authReady: jest.fn().mockResolvedValue(undefined),
    getAuthHeaders: () => ({ Authorization: 'Bearer owner-token' }),
}))
jest.mock('@/constants/general.consts', () => ({ PEANUT_API_URL: 'https://api.example.test' }))
jest.mock('@capacitor/core', () => ({ CapacitorHttp: { request: jest.fn() } }))
jest.mock('@/components/Card/share-asset/captureShareAsset', () => ({ downloadBlob: jest.fn() }))
const fetchMock = serverFetch as jest.Mock
const native = isCapacitor as jest.Mock

const queryOf = (url: string) => new URLSearchParams(url.split('?')[1])

const fileResponse = (type: string, disposition: string | null = null) => ({
    ok: true,
    headers: { get: (name: string) => (name === 'content-type' ? type : disposition) },
    blob: async () => new Blob(['file'], { type }),
})
const pdfResponse = (disposition: string | null = null) => fileResponse('application/pdf', disposition)

beforeEach(() => {
    jest.clearAllMocks()
    native.mockReturnValue(false)
})

describe('statement downloads', () => {
    it('asks the export endpoint for the format, period, locale and time zone', async () => {
        fetchMock.mockResolvedValue(fileResponse('text/csv; charset=utf-8'))
        const file = await prepareStatement({
            format: 'csv',
            locale: 'pt-BR',
            fromIso: '2026-08-01T00:00:00.000Z',
            toIso: '2026-08-31T23:59:59.999Z',
        })
        // no Content-Disposition: the file falls back to the API's own name family
        expect(file.fileName).toBe('peanut-activity.csv')

        const [url] = fetchMock.mock.calls[0]
        expect(url.split('?')[0]).toBe('/users/history/export')
        const query = queryOf(url)
        expect(query.get('format')).toBe('csv')
        expect(query.get('locale')).toBe('pt-BR')
        expect(query.get('timeZone')).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone)
        expect(query.get('from')).toBe('2026-08-01T00:00:00.000Z')
        // `to` is exclusive on the API: the end of the last day plus 1 ms
        expect(query.get('to')).toBe('2026-09-01T00:00:00.000Z')
    })

    it('sends no bounds for all time', async () => {
        fetchMock.mockResolvedValue(pdfResponse())
        await prepareStatement({ format: 'pdf', locale: 'en' })
        const query = queryOf(fetchMock.mock.calls[0][0])
        expect(query.has('from')).toBe(false)
        expect(query.has('to')).toBe(false)
    })

    it('fetches private bytes through the authenticated client with telemetry redacted', async () => {
        fetchMock.mockResolvedValue(pdfResponse('attachment; filename="activity.pdf"'))
        const prepared = await prepareStatement({ format: 'pdf', locale: 'en' })
        expect(fetchMock).toHaveBeenCalledWith(
            expect.stringContaining('format=pdf&timeZone='),
            expect.objectContaining({ redactTelemetry: true, cache: 'no-store' })
        )
        expect(prepared.fileName).toBe('activity.pdf')
        expect(downloadBlob).not.toHaveBeenCalled()
        expect(await saveStatement(prepared)).toBe('saved')
        expect(downloadBlob).toHaveBeenCalledWith(prepared.blob, 'activity.pdf')
    })

    // the API accepts exactly these four values, so each one must reach it unchanged
    it.each(['en', 'es-419', 'es-AR', 'pt-BR'] as const)(
        'asks for the file in %s on the web and on native',
        async (locale) => {
            fetchMock.mockResolvedValue(pdfResponse())
            await prepareStatement({ format: 'pdf', locale })
            expect(queryOf(fetchMock.mock.calls[0][0]).get('locale')).toBe(locale)

            native.mockReturnValue(true)
            ;(CapacitorHttp.request as jest.Mock).mockResolvedValue({ status: 200, data: btoa('%PDF'), headers: {} })
            await prepareStatement({ format: 'pdf', locale })
            expect(queryOf((CapacitorHttp.request as jest.Mock).mock.calls[0][0].url).get('locale')).toBe(locale)
        }
    )

    it('keeps server validation failures out of downloaded files', async () => {
        fetchMock.mockResolvedValue({
            ok: false,
            json: async () => ({ code: 'EXPORT_UNVERIFIED', reason: 'reward-credit-missing' }),
        })
        await expect(prepareStatement({ format: 'xlsx', locale: 'en' })).rejects.toMatchObject({
            message: 'EXPORT_UNVERIFIED',
            refusal: 'reward-credit-missing',
        })
        expect(downloadBlob).not.toHaveBeenCalled()
    })

    it('refuses a body that is not the requested file type', async () => {
        fetchMock.mockResolvedValue({
            ok: true,
            headers: { get: () => 'application/json' },
            blob: async () => new Blob(['{}']),
        })
        await expect(prepareStatement({ format: 'pdf', locale: 'en' })).rejects.toThrow('EXPORT_FAILED')
    })

    it('maps native status codes to the API codes', async () => {
        native.mockReturnValue(true)
        const request = CapacitorHttp.request as jest.Mock
        request.mockResolvedValueOnce({ status: 413, data: btoa('{}'), headers: {} })
        await expect(prepareStatement({ format: 'pdf', locale: 'en' })).rejects.toThrow('EXPORT_TOO_LARGE')
        request.mockResolvedValueOnce({
            status: 409,
            data: btoa(JSON.stringify({ code: 'EXPORT_UNVERIFIED', reason: 'balance-mismatch' })),
            headers: {},
        })
        await expect(prepareStatement({ format: 'pdf', locale: 'en' })).rejects.toMatchObject({
            message: 'EXPORT_UNVERIFIED',
            refusal: 'balance-mismatch',
        })
        request.mockResolvedValueOnce({ status: 429, data: btoa('{}'), headers: {} })
        await expect(prepareStatement({ format: 'pdf', locale: 'en' })).rejects.toThrow('EXPORT_BUSY')
    })

    it('fetches native XLSX as a binary with owner auth', async () => {
        native.mockReturnValue(true)
        ;(CapacitorHttp.request as jest.Mock).mockResolvedValue({
            status: 200,
            data: btoa('PK workbook'),
            headers: { 'Content-Disposition': 'attachment; filename="activity.xlsx"' },
        })
        const file = await prepareStatement({ format: 'xlsx', locale: 'en' })
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
        expect(await saveStatement({ blob: new Blob(['file']), fileName: 'activity.csv' })).toBe('cancelled')
        expect(downloadBlob).not.toHaveBeenCalled()
    })

    it('fails explicitly when native cannot save, rather than silently using an unsupported anchor', async () => {
        native.mockReturnValue(true)
        Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => false })
        await expect(saveStatement({ blob: new Blob(['file']), fileName: 'activity.csv' })).rejects.toThrow(
            'EXPORT_SAVE_UNAVAILABLE'
        )
    })
})

describe('downloadFailure', () => {
    it('names the failure the page shows for each code', () => {
        expect(downloadFailure('EXPORT_TOO_LARGE')).toBe('tooLarge')
        expect(downloadFailure('EXPORT_UNVERIFIED')).toBe('unverified')
        expect(downloadFailure('EXPORT_BUSY')).toBe('busy')
        expect(downloadFailure('EXPORT_SAVE_UNAVAILABLE')).toBe('saveUnavailable')
        expect(downloadFailure('INVALID_RANGE')).toBe('failed')
        expect(downloadFailure('EXPORT_FAILED')).toBe('failed')
    })
})
