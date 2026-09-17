import { serverFetch } from '@/utils/api-fetch'
import { isCapacitor } from '@/utils/capacitor'
import { authReady, getAuthHeaders } from '@/utils/auth-token'
import { PEANUT_API_URL } from '@/constants/general.consts'
import { downloadBlob } from '@/components/Card/share-asset/captureShareAsset'

export type ActivityExportFormat = 'pdf' | 'csv' | 'xlsx'
export type ActivityExportFile = { blob: Blob; fileName: string }
export class ActivityDownloadError extends Error {}

const MIME: Record<ActivityExportFormat, string> = {
    pdf: 'application/pdf',
    csv: 'text/csv',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
}

export async function prepareActivityExport(options: {
    format: ActivityExportFormat
    fromIso?: string
    toIso?: string
}): Promise<ActivityExportFile> {
    const params = new URLSearchParams({ format: options.format })
    params.set('timeZone', Intl.DateTimeFormat().resolvedOptions().timeZone)
    if (options.fromIso) params.set('from', options.fromIso)
    if (options.toIso) params.set('to', new Date(new Date(options.toIso).getTime() + 1).toISOString())
    const path = `/users/history/export?${params}`
    let blob: Blob
    let disposition: string | null
    if (isCapacitor()) {
        await authReady()
        const headers = getAuthHeaders()
        if (!headers.Authorization) throw new ActivityDownloadError('EXPORT_FAILED')
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
            throw new ActivityDownloadError(
                response.status === 413
                    ? 'EXPORT_TOO_LARGE'
                    : response.status === 409
                      ? 'EXPORT_UNVERIFIED'
                      : response.status === 429
                        ? 'EXPORT_BUSY'
                        : 'EXPORT_FAILED'
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
            const body = (await response.json().catch(() => ({}))) as { code?: string }
            throw new ActivityDownloadError(body.code ?? 'EXPORT_FAILED')
        }
        if (!response.headers.get('content-type')?.startsWith(MIME[options.format]))
            throw new ActivityDownloadError('EXPORT_FAILED')
        blob = await response.blob()
        disposition = response.headers.get('content-disposition')
    }
    const suppliedName = disposition?.match(/filename="([A-Za-z0-9._-]+)"/)?.[1]
    return { blob, fileName: suppliedName ?? `peanut-activity.${options.format}` }
}

/** Native callers invoke this on a fresh tap after preparation, preserving user activation. */
export async function saveActivityExport(prepared: ActivityExportFile): Promise<'saved' | 'cancelled'> {
    if (isCapacitor()) {
        const file = new File([prepared.blob], prepared.fileName, { type: prepared.blob.type })
        if (!navigator.share || !navigator.canShare?.({ files: [file] }))
            throw new ActivityDownloadError('EXPORT_SAVE_UNAVAILABLE')
        try {
            await navigator.share({ files: [file] })
        } catch (error) {
            if ((error as Error).name === 'AbortError') return 'cancelled'
            throw error
        }
    } else downloadBlob(prepared.blob, prepared.fileName)
    return 'saved'
}
