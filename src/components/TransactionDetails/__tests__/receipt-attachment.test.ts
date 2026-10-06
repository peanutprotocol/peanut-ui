import { Capacitor, CapacitorHttp } from '@capacitor/core'
import { Filesystem } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'
import { isCapacitor, isNativeBridge } from '@/utils/capacitor'
import { downloadBlob } from '@/components/Card/share-asset/captureShareAsset'
import {
    attachmentUrl,
    fetchReceiptAttachment,
    deliverReceiptAttachment,
    canDeliverReceiptAttachment,
    MAX_ATTACHMENT_BYTES,
} from '../receipt-attachment'

jest.mock('@capacitor/core', () => ({
    Capacitor: { isPluginAvailable: jest.fn(() => true) },
    CapacitorHttp: { request: jest.fn() },
}))
jest.mock('@capacitor/filesystem', () => ({
    Directory: { Cache: 'CACHE' },
    Filesystem: { writeFile: jest.fn(), deleteFile: jest.fn(), readdir: jest.fn() },
}))
jest.mock('@capacitor/share', () => ({ Share: { share: jest.fn() } }))
jest.mock('@/utils/capacitor', () => ({ isNativeBridge: jest.fn(() => false), isCapacitor: jest.fn(() => false) }))
jest.mock('@/components/Card/share-asset/captureShareAsset', () => ({ downloadBlob: jest.fn() }))

const url = 'https://peanut-notes.s3.eu-north-1.amazonaws.com/uploads_receipt.pdf'
const bytes = Uint8Array.from(new TextEncoder().encode('%PDF-1.7\nverified attachment'))
const signal = () => new AbortController().signal
const webResponse = (body = bytes, type = 'application/pdf') => ({
    ok: true,
    status: 200,
    url,
    headers: new Headers({ 'content-type': type }),
    arrayBuffer: jest.fn().mockResolvedValue(body.buffer),
})

beforeEach(() => {
    jest.clearAllMocks()
    ;(isNativeBridge as jest.Mock).mockReturnValue(false)
    ;(Capacitor.isPluginAvailable as jest.Mock).mockReturnValue(true)
    ;(Filesystem.writeFile as jest.Mock).mockResolvedValue({ uri: 'file:///cache/attachment.pdf' })
    ;(Filesystem.deleteFile as jest.Mock).mockResolvedValue(undefined)
    ;(Filesystem.readdir as jest.Mock).mockResolvedValue({ files: [] })
    ;(Share.share as jest.Mock).mockResolvedValue({ activityType: '' })
    global.fetch = jest.fn().mockResolvedValue(webResponse())
})

describe('receipt attachment URLs', () => {
    test('preserves encoded object keys and signed queries', () => {
        const signed = `${url}?X-Amz-Signature=a%2Fb&download=receipt%20copy.pdf`
        expect(attachmentUrl(`  ${signed}  `)).toBe(signed)
        expect(attachmentUrl(url.replace('https:', 'HTTPS:'))).toBe(url)
    })

    test.each([
        '',
        'uploads_receipt.pdf',
        '/uploads_receipt.pdf',
        '//peanut-notes.s3.eu-north-1.amazonaws.com/receipt.pdf',
        'https://peanut.me/404',
        'https://peanut-notes.s3.eu-north-1.amazonaws.com.evil.test/receipt.pdf',
        'https://user@peanut-notes.s3.eu-north-1.amazonaws.com/receipt.pdf',
        'https://peanut-notes.s3.eu-north-1.amazonaws.com:444/receipt.pdf',
        'https://peanut-notes.s3.eu-north-1.amazonaws.com/',
        `${url}#fragment`,
        `${url}\n?x=1`,
        `\n${url}`,
        'javascript:alert(1)',
    ])('does not fetch or navigate an invalid stored URL: %s', async (invalid) => {
        expect(attachmentUrl(invalid)).toBeNull()
        await expect(fetchReceiptAttachment(invalid, signal())).rejects.toThrow()
        expect(fetch).not.toHaveBeenCalled()
        expect(CapacitorHttp.request).not.toHaveBeenCalled()
    })
})

describe('verified attachment files', () => {
    test('downloads the PDF bytes once, without sending account credentials', async () => {
        const file = await fetchReceiptAttachment(url, signal())
        expect(file).toEqual({ bytes, mimeType: 'application/pdf', extension: 'pdf' })
        expect(fetch).toHaveBeenCalledWith(url, expect.objectContaining({ credentials: 'omit', redirect: 'error' }))
        await deliverReceiptAttachment(file)
        expect(downloadBlob).toHaveBeenCalledWith(expect.any(Blob), 'peanut-attachment.pdf')
    })

    test('a native-build browser preview still uses browser download without native plugins', async () => {
        ;(isCapacitor as jest.Mock).mockReturnValue(true)
        ;(isNativeBridge as jest.Mock).mockReturnValue(false)
        ;(Capacitor.isPluginAvailable as jest.Mock).mockReturnValue(false)
        expect(canDeliverReceiptAttachment()).toBe(true)
        await deliverReceiptAttachment(await fetchReceiptAttachment(url, signal()))
        expect(fetch).toHaveBeenCalled()
        expect(downloadBlob).toHaveBeenCalled()
        expect(CapacitorHttp.request).not.toHaveBeenCalled()
        expect(Share.share).not.toHaveBeenCalled()
    })

    test.each([403, 404])('keeps an expired or missing attachment out of navigation (%s)', async (status) => {
        ;(fetch as jest.Mock).mockResolvedValue({ ok: false, status })
        await expect(fetchReceiptAttachment(url, signal())).rejects.toThrow()
        expect(downloadBlob).not.toHaveBeenCalled()
        expect(Share.share).not.toHaveBeenCalled()
    })

    test('rejects an HTML 404 body even when a server calls it a PDF', async () => {
        ;(fetch as jest.Mock).mockResolvedValue(webResponse(new TextEncoder().encode('<html>404</html>')))
        await expect(fetchReceiptAttachment(url, signal())).rejects.toThrow()
    })

    test('preserves a valid image attachment without labelling it a PDF', async () => {
        const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0])
        ;(fetch as jest.Mock).mockResolvedValue(webResponse(png, 'image/png'))
        expect(await fetchReceiptAttachment(url.replace('.pdf', '.png'), signal())).toEqual({
            bytes: png,
            mimeType: 'image/png',
            extension: 'png',
        })
    })

    test('preserves an iPhone HEIC attachment', async () => {
        const heic = new Uint8Array([0, 0, 0, 24, 102, 116, 121, 112, 104, 101, 105, 99, 0, 0, 0, 0])
        ;(fetch as jest.Mock).mockResolvedValue(webResponse(heic, 'image/heic'))
        expect(await fetchReceiptAttachment(url.replace('.pdf', '.heic'), signal())).toEqual({
            bytes: heic,
            mimeType: 'image/heic',
            extension: 'heic',
        })
    })

    test('rejects files larger than the upload limit', async () => {
        ;(fetch as jest.Mock).mockResolvedValue(webResponse(new Uint8Array(MAX_ATTACHMENT_BYTES + 1)))
        await expect(fetchReceiptAttachment(url, signal())).rejects.toThrow()
    })

    test('Android fetches binary bytes with native HTTP and shares a cached file, never a browser URL', async () => {
        ;(isNativeBridge as jest.Mock).mockReturnValue(true)
        ;(CapacitorHttp.request as jest.Mock).mockResolvedValue({
            status: 200,
            data: btoa('%PDF-1.7\nverified attachment'),
            headers: { 'Content-Type': 'application/pdf' },
            url,
        })
        const file = await fetchReceiptAttachment(url, signal())
        await deliverReceiptAttachment(file)
        expect(CapacitorHttp.request).toHaveBeenCalledWith(
            expect.objectContaining({ url, responseType: 'arraybuffer', disableRedirects: true })
        )
        expect(Filesystem.writeFile).toHaveBeenCalledWith(
            expect.objectContaining({ directory: 'CACHE', data: btoa('%PDF-1.7\nverified attachment') })
        )
        expect(Share.share).toHaveBeenCalledWith({ files: ['file:///cache/attachment.pdf'] })
        expect(fetch).not.toHaveBeenCalled()
        expect(downloadBlob).not.toHaveBeenCalled()
    })

    test.each([403, 404])('Android rejects unavailable attachment status %s before delivery', async (status) => {
        ;(isNativeBridge as jest.Mock).mockReturnValue(true)
        ;(CapacitorHttp.request as jest.Mock).mockResolvedValue({ status, data: btoa('error'), headers: {} })
        await expect(fetchReceiptAttachment(url, signal())).rejects.toThrow()
        expect(Filesystem.writeFile).not.toHaveBeenCalled()
        expect(Share.share).not.toHaveBeenCalled()
    })

    test('Android rejects a relative attachment before HTTP or file delivery', async () => {
        ;(isNativeBridge as jest.Mock).mockReturnValue(true)
        await expect(fetchReceiptAttachment('/uploads_receipt.pdf', signal())).rejects.toThrow()
        expect(CapacitorHttp.request).not.toHaveBeenCalled()
        expect(Share.share).not.toHaveBeenCalled()
    })

    test('old native binaries cannot fall back to a DOM download', async () => {
        ;(isNativeBridge as jest.Mock).mockReturnValue(true)
        ;(Capacitor.isPluginAvailable as jest.Mock).mockReturnValue(false)
        expect(canDeliverReceiptAttachment()).toBe(false)
        await expect(
            deliverReceiptAttachment({ bytes, mimeType: 'application/pdf', extension: 'pdf' })
        ).rejects.toThrow()
        expect(downloadBlob).not.toHaveBeenCalled()
        expect(Share.share).not.toHaveBeenCalled()
    })

    test('Android base64 line breaks do not corrupt a valid file', async () => {
        ;(isNativeBridge as jest.Mock).mockReturnValue(true)
        const encoded = btoa('%PDF-1.7\nverified attachment')
        ;(CapacitorHttp.request as jest.Mock).mockResolvedValue({
            status: 200,
            data: `${encoded.slice(0, 8)}\r\n${encoded.slice(8)}\n`,
            headers: {},
        })
        expect((await fetchReceiptAttachment(url, signal())).bytes).toEqual(bytes)
    })

    test('Android rejects a JSON error even when native HTTP decoded it as an object', async () => {
        ;(isNativeBridge as jest.Mock).mockReturnValue(true)
        ;(CapacitorHttp.request as jest.Mock).mockResolvedValue({
            status: 200,
            data: { error: 'not found' },
            headers: {},
        })
        await expect(fetchReceiptAttachment(url, signal())).rejects.toThrow()
    })

    test('cancelling the native share sheet is not a download failure', async () => {
        ;(isNativeBridge as jest.Mock).mockReturnValue(true)
        ;(Share.share as jest.Mock).mockRejectedValue(new Error('Share canceled'))
        await expect(
            deliverReceiptAttachment({ bytes, mimeType: 'application/pdf', extension: 'pdf' })
        ).resolves.toBeUndefined()
        expect(Filesystem.deleteFile).toHaveBeenCalledWith(expect.objectContaining({ directory: 'CACHE' }))
    })

    test('only stale cached attachments are deleted before sharing', async () => {
        ;(isNativeBridge as jest.Mock).mockReturnValue(true)
        ;(Filesystem.readdir as jest.Mock).mockResolvedValue({
            files: [
                { name: 'old.pdf', type: 'file', mtime: Date.now() - 48 * 60 * 60 * 1000 },
                { name: 'recent.pdf', type: 'file', mtime: Date.now() },
            ],
        })
        await deliverReceiptAttachment({ bytes, mimeType: 'application/pdf', extension: 'pdf' })
        expect(Filesystem.deleteFile).toHaveBeenCalledTimes(1)
        expect(Filesystem.deleteFile).toHaveBeenCalledWith({ path: 'receipt-attachments/old.pdf', directory: 'CACHE' })
    })

    test('aborting an in-flight native fetch discards its eventual result', async () => {
        ;(isNativeBridge as jest.Mock).mockReturnValue(true)
        ;(CapacitorHttp.request as jest.Mock).mockReturnValue(new Promise(() => {}))
        const controller = new AbortController()
        const pending = fetchReceiptAttachment(url, controller.signal)
        controller.abort()
        await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    })

    test('native fetch has a wall-clock timeout even when the OS request never finishes', async () => {
        jest.useFakeTimers()
        try {
            ;(isNativeBridge as jest.Mock).mockReturnValue(true)
            ;(CapacitorHttp.request as jest.Mock).mockReturnValue(new Promise(() => {}))
            const pending = expect(fetchReceiptAttachment(url, signal())).rejects.toMatchObject({ name: 'AbortError' })
            await jest.advanceTimersByTimeAsync(30_000)
            await pending
        } finally {
            jest.useRealTimers()
        }
    })
})
