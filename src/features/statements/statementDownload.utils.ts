import { serverFetch } from '@/utils/api-fetch'
import { isCapacitor } from '@/utils/capacitor'
import { authReady, getAuthHeaders } from '@/utils/auth-token'
import { PEANUT_API_URL } from '@/constants/general.consts'
import { downloadBlob } from '@/components/Card/share-asset/captureShareAsset'
import type { AppLocale } from '@/i18n/app/config'

export const STATEMENT_FORMATS = ['pdf', 'csv', 'xlsx'] as const
export type StatementFormat = (typeof STATEMENT_FORMATS)[number]
export type StatementFile = { blob: Blob; fileName: string }

/** What the page says when a download fails. `tooLarge` is the one failure the
 *  period field can fix, so it is shown under that field; the rest are flow
 *  failures. */
export type StatementDownloadFailure = 'tooLarge' | 'unverified' | 'busy' | 'saveUnavailable' | 'failed'

/** `message` is the API code; `refusal` names the check that refused the file, when the API says. */
export class StatementDownloadError extends Error {
    constructor(
        code: string,
        public refusal?: string
    ) {
        super(code)
    }
}

const FAILURES = new Map<string, StatementDownloadFailure>([
    ['EXPORT_TOO_LARGE', 'tooLarge'],
    ['EXPORT_UNVERIFIED', 'unverified'],
    ['EXPORT_BUSY', 'busy'],
    ['EXPORT_SAVE_UNAVAILABLE', 'saveUnavailable'],
])

/** The failure to show for an API or delivery code; unknown codes are a plain failure. */
export function downloadFailure(code: string): StatementDownloadFailure {
    return FAILURES.get(code) ?? 'failed'
}

/** The API's 4xx body, whatever transport delivered it. */
function refusalFrom(body: unknown): { code?: string; refusal?: string } {
    if (!body || typeof body !== 'object') return {}
    const { code, reason } = body as { code?: unknown; reason?: unknown }
    return {
        code: typeof code === 'string' ? code : undefined,
        refusal: typeof reason === 'string' ? reason : undefined,
    }
}

const MIME: Record<StatementFormat, string> = {
    pdf: 'application/pdf',
    csv: 'text/csv',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
}

/** Fetches the statement file over the authenticated client. Nothing is saved yet. */
export async function prepareStatement(options: {
    format: StatementFormat
    /** The API accepts exactly the app locales and writes PDF and XLSX files in that language. */
    locale: AppLocale
    fromIso?: string
    toIso?: string
}): Promise<StatementFile> {
    const params = new URLSearchParams({ format: options.format })
    params.set('timeZone', Intl.DateTimeFormat().resolvedOptions().timeZone)
    params.set('locale', options.locale)
    if (options.fromIso) params.set('from', options.fromIso)
    // the API's `to` is exclusive: the next local midnight after the last day
    if (options.toIso) params.set('to', new Date(new Date(options.toIso).getTime() + 1).toISOString())
    const path = `/users/history/export?${params}`
    let blob: Blob
    let disposition: string | null
    if (isCapacitor()) {
        await authReady()
        // No readable token here is either a signed-out app or a legacy session
        // whose JWT lives only in the OS cookie jar (unreadable from JS on
        // Android). The OS HTTP client attaches that cookie, as apiFetch does
        // (preferNativeTransport); the API answers 401 when there is no session.
        const headers = getAuthHeaders()
        const { CapacitorHttp } = await import('@capacitor/core')
        const response = await CapacitorHttp.request({
            url: `${PEANUT_API_URL}${path}`,
            method: 'GET',
            headers,
            responseType: 'arraybuffer',
            connectTimeout: 15_000,
            readTimeout: 60_000,
        })
        if (response.status !== 200 || typeof response.data !== 'string') {
            // an error body arrives base64-encoded like the file would; decode it for the reason
            let body: unknown = null
            try {
                body = typeof response.data === 'string' ? JSON.parse(atob(response.data)) : response.data
            } catch {
                body = null
            }
            const { refusal } = refusalFrom(body)
            throw new StatementDownloadError(
                response.status === 413
                    ? 'EXPORT_TOO_LARGE'
                    : response.status === 409
                      ? 'EXPORT_UNVERIFIED'
                      : response.status === 429
                        ? 'EXPORT_BUSY'
                        : 'EXPORT_FAILED',
                refusal
            )
        }
        const bytes = Uint8Array.from(atob(response.data), (char) => char.charCodeAt(0))
        blob = new Blob([bytes], { type: MIME[options.format] })
        disposition = response.headers['content-disposition'] ?? response.headers['Content-Disposition']
    } else {
        const response = await serverFetch(path, {
            method: 'GET',
            cache: 'no-store',
            timeoutMs: 60_000,
            redactTelemetry: true,
        })
        if (!response.ok) {
            const { code, refusal } = refusalFrom(await response.json().catch(() => null))
            throw new StatementDownloadError(code ?? 'EXPORT_FAILED', refusal)
        }
        if (!response.headers.get('content-type')?.startsWith(MIME[options.format]))
            throw new StatementDownloadError('EXPORT_FAILED')
        blob = await response.blob()
        disposition = response.headers.get('content-disposition')
    }
    const suppliedName = disposition?.match(/filename="([A-Za-z0-9._-]+)"/)?.[1]
    return { blob, fileName: suppliedName ?? `peanut-activity.${options.format}` }
}

const CACHE_DIRECTORY = 'statements'
const CACHE_KEEP_MS = 24 * 60 * 60 * 1000

/** Writes the file to the app cache and hands it to the system share sheet through the native plugins. */
async function shareFromCache(file: StatementFile): Promise<'saved' | 'cancelled'> {
    const [{ Filesystem, Directory }, { Share }] = await Promise.all([
        import('@capacitor/filesystem'),
        import('@capacitor/share'),
    ])
    // the receiving app may read the file after the share sheet closes, so an
    // earlier save goes at a later one, not after its own (as receipt attachments do)
    try {
        const { files } = await Filesystem.readdir({ path: CACHE_DIRECTORY, directory: Directory.Cache })
        await Promise.all(
            files
                .filter((entry) => entry.mtime < Date.now() - CACHE_KEEP_MS)
                .map((entry) =>
                    Filesystem.rmdir({
                        path: `${CACHE_DIRECTORY}/${entry.name}`,
                        directory: Directory.Cache,
                        recursive: true,
                    })
                )
        )
    } catch {
        // the cache directory does not exist before the first save
    }
    const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result).split(',')[1])
        reader.onerror = () => reject(reader.error ?? new Error('Unable to read the statement'))
        reader.readAsDataURL(file.blob)
    })
    // one folder per save: the same period saved twice has the same file name, and a
    // second save must not replace the bytes behind the address the first one shared
    const id = Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) =>
        byte.toString(16).padStart(2, '0')
    ).join('')
    const { uri } = await Filesystem.writeFile({
        path: `${CACHE_DIRECTORY}/${id}/${file.fileName}`,
        directory: Directory.Cache,
        data,
        recursive: true,
    })
    try {
        await Share.share({ files: [uri] })
    } catch (error) {
        // the plugin rejects a dismissed sheet with "Share canceled"
        if (error instanceof Error && (error.message === 'Share canceled' || error.name === 'AbortError'))
            return 'cancelled'
        throw error
    }
    return 'saved'
}

/** Native callers invoke this on a fresh tap after preparation, preserving user activation. */
export async function saveStatement(file: StatementFile): Promise<'saved' | 'cancelled'> {
    if (!isCapacitor()) {
        downloadBlob(file.blob, file.fileName)
        return 'saved'
    }
    // Android's WebView has no navigator.share, so an app that ships the file
    // plugins saves through them. An app built before the plugins keeps the web
    // share sheet, which needs the tap's user activation: no await comes before it.
    if (window.Capacitor?.isPluginAvailable?.('Filesystem') && window.Capacitor?.isPluginAvailable?.('Share'))
        return shareFromCache(file)
    const shared = new File([file.blob], file.fileName, { type: file.blob.type })
    if (!navigator.share || !navigator.canShare?.({ files: [shared] }))
        throw new StatementDownloadError('EXPORT_SAVE_UNAVAILABLE')
    try {
        await navigator.share({ files: [shared] })
    } catch (error) {
        if ((error as Error).name === 'AbortError') return 'cancelled'
        throw error
    }
    return 'saved'
}
