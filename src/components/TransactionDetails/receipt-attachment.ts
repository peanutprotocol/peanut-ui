import { Capacitor, CapacitorHttp } from '@capacitor/core'
import { isNativeBridge } from '@/utils/capacitor'
import { downloadBlob } from '@/components/Card/share-asset/captureShareAsset'

const ATTACHMENT_HOST = 'peanut-notes.s3.eu-north-1.amazonaws.com'
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024
const FETCH_TIMEOUT_MS = 30_000
const CACHE_DIRECTORY = 'receipt-attachments'

export type ReceiptAttachment = { bytes: Uint8Array<ArrayBuffer>; mimeType: string; extension: string }

export function attachmentUrl(value: string | null | undefined): string | null {
    if (!value || /[\u0000-\u001f\u007f\\]/.test(value)) return null
    const candidate = value.trim()
    if (!/^https:\/\//i.test(candidate)) return null
    try {
        const url = new URL(candidate)
        return url.hostname === ATTACHMENT_HOST &&
            !url.username &&
            !url.password &&
            !url.port &&
            !url.hash &&
            url.pathname !== '/'
            ? url.href
            : null
    } catch {
        return null
    }
}

function verifiedFile(bytes: Uint8Array<ArrayBuffer>): ReceiptAttachment {
    if (bytes.length === 0 || bytes.length > MAX_ATTACHMENT_BYTES) throw new Error('Attachment size is invalid')
    const startsWith = (signature: number[]) => signature.every((byte, index) => bytes[index] === byte)
    if (startsWith([37, 80, 68, 70, 45])) return { bytes, mimeType: 'application/pdf', extension: 'pdf' }
    if (startsWith([137, 80, 78, 71, 13, 10, 26, 10])) return { bytes, mimeType: 'image/png', extension: 'png' }
    if (startsWith([255, 216, 255])) return { bytes, mimeType: 'image/jpeg', extension: 'jpg' }
    if (startsWith([71, 73, 70, 56]) && [55, 57].includes(bytes[4]) && bytes[5] === 97)
        return { bytes, mimeType: 'image/gif', extension: 'gif' }
    if (startsWith([82, 73, 70, 70]) && new TextDecoder().decode(bytes.slice(8, 12)) === 'WEBP')
        return { bytes, mimeType: 'image/webp', extension: 'webp' }
    if (new TextDecoder().decode(bytes.slice(4, 8)) === 'ftyp') {
        const brand = new TextDecoder().decode(bytes.slice(8, 12))
        if (['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1'].includes(brand))
            return { bytes, mimeType: 'image/heic', extension: 'heic' }
        if (['avif', 'avis'].includes(brand)) return { bytes, mimeType: 'image/avif', extension: 'avif' }
    }
    throw new Error('Attachment is not a supported document')
}

export async function fetchReceiptAttachment(rawUrl: string, signal: AbortSignal): Promise<ReceiptAttachment> {
    const url = attachmentUrl(rawUrl)
    if (!url) throw new Error('Attachment URL is invalid')
    const controller = new AbortController()
    const abort = () => controller.abort()
    if (signal.aborted) controller.abort()
    signal.addEventListener('abort', abort, { once: true })
    const timeout = setTimeout(abort, FETCH_TIMEOUT_MS)
    let rejectAbort: () => void = () => {}
    const cancelled = new Promise<never>((_, reject) => {
        rejectAbort = () => reject(new DOMException('Attachment request cancelled', 'AbortError'))
        if (controller.signal.aborted) rejectAbort()
        else controller.signal.addEventListener('abort', rejectAbort, { once: true })
    })
    try {
        const load = async () => {
            if (controller.signal.aborted) throw new DOMException('Attachment request cancelled', 'AbortError')
            if (isNativeBridge()) {
                const response = await CapacitorHttp.request({
                    url,
                    method: 'GET',
                    responseType: 'arraybuffer',
                    disableRedirects: true,
                    connectTimeout: 15_000,
                    readTimeout: FETCH_TIMEOUT_MS,
                })
                if (response.status !== 200 || typeof response.data !== 'string')
                    throw new Error('Attachment is unavailable')
                if (response.url && attachmentUrl(response.url) !== url)
                    throw new Error('Attachment redirect is not allowed')
                const encoded = response.data.replace(/\s/g, '')
                if (encoded.length > Math.ceil(MAX_ATTACHMENT_BYTES / 3) * 4) throw new Error('Attachment is too large')
                const binary = atob(encoded)
                return verifiedFile(Uint8Array.from(binary, (character) => character.charCodeAt(0)))
            }
            const response = await fetch(url, {
                credentials: 'omit',
                redirect: 'error',
                cache: 'no-store',
                referrerPolicy: 'no-referrer',
                signal: controller.signal,
            })
            if (!response.ok || response.status !== 200) throw new Error('Attachment is unavailable')
            if (Number(response.headers.get('content-length')) > MAX_ATTACHMENT_BYTES)
                throw new Error('Attachment is too large')
            return verifiedFile(new Uint8Array(await response.arrayBuffer()))
        }
        // native http has no abort method; a late result must never reach the changed receipt.
        return await Promise.race([load(), cancelled])
    } finally {
        clearTimeout(timeout)
        signal.removeEventListener('abort', abort)
        controller.signal.removeEventListener('abort', rejectAbort)
    }
}

export function canDeliverReceiptAttachment(): boolean {
    return !isNativeBridge() || (Capacitor.isPluginAvailable('Filesystem') && Capacitor.isPluginAvailable('Share'))
}

export async function deliverReceiptAttachment(file: ReceiptAttachment): Promise<void> {
    if (!canDeliverReceiptAttachment()) throw new Error('An app update is required')
    if (!isNativeBridge()) {
        downloadBlob(new Blob([file.bytes], { type: file.mimeType }), `peanut-attachment.${file.extension}`)
        return
    }
    const [{ Filesystem, Directory }, { Share }] = await Promise.all([
        import('@capacitor/filesystem'),
        import('@capacitor/share'),
    ])
    // the receiving app may read after the chooser resolves; keep recent files until the next cleanup.
    try {
        const { files } = await Filesystem.readdir({ path: CACHE_DIRECTORY, directory: Directory.Cache })
        await Promise.all(
            files
                .filter((entry) => entry.type === 'file' && entry.mtime < Date.now() - 24 * 60 * 60 * 1000)
                .map((entry) =>
                    Filesystem.deleteFile({ path: `${CACHE_DIRECTORY}/${entry.name}`, directory: Directory.Cache })
                )
        )
    } catch {
        // the cache directory does not exist before the first download.
    }
    let binary = ''
    for (let offset = 0; offset < file.bytes.length; offset += 32_768)
        binary += String.fromCharCode(...file.bytes.subarray(offset, offset + 32_768))
    const id = Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) =>
        byte.toString(16).padStart(2, '0')
    ).join('')
    const path = `${CACHE_DIRECTORY}/peanut-attachment-${id}.${file.extension}`
    const { uri } = await Filesystem.writeFile({
        path,
        directory: Directory.Cache,
        data: btoa(binary),
        recursive: true,
    })
    try {
        await Share.share({ files: [uri] })
    } catch (error) {
        await Filesystem.deleteFile({ path, directory: Directory.Cache }).catch(() => {})
        if (error instanceof Error && (error.message === 'Share canceled' || error.name === 'AbortError')) return
        throw error
    }
}
