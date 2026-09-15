import { serverFetch } from '@/utils/api-fetch'
import { isCapacitor } from '@/utils/capacitor'
import { downloadBlob } from '@/components/Card/share-asset/captureShareAsset'

export type ActivityExportFormat = 'pdf' | 'csv' | 'xlsx'

const EXPORT_MIME: Record<ActivityExportFormat, string> = {
    pdf: 'application/pdf',
    csv: 'text/csv',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
}

function fileNameFromDisposition(header: string | null): string | undefined {
    const match = header?.match(/filename="([^"]+)"/)
    return match?.[1]
}

/**
 * Fetch the activity export from `GET /users/history/export` and hand the file
 * to the user: anchor download on the web, the system share sheet on native
 * (same probe-then-share shape as the card share asset — route handlers do not
 * exist in the native build, so the bytes must arrive over authed fetch).
 */
export async function downloadActivityExport(options: {
    format: ActivityExportFormat
    fromIso?: string
    toIso?: string
}): Promise<{ fileName: string }> {
    const params = new URLSearchParams({ format: options.format })
    if (options.fromIso) params.append('from', options.fromIso)
    if (options.toIso) params.append('to', options.toIso)

    const response = await serverFetch(`/users/history/export?${params.toString()}`, {
        method: 'GET',
        cache: 'no-store',
    })
    if (!response.ok) {
        const body = (await response.json().catch(() => undefined)) as { error?: string } | undefined
        throw new Error(body?.error ?? `Export failed (${response.status})`)
    }

    const blob = await response.blob()
    const fileName =
        fileNameFromDisposition(response.headers.get('content-disposition')) ?? `peanut-activity.${options.format}`

    if (isCapacitor() && typeof navigator !== 'undefined' && 'share' in navigator) {
        const file = new File([blob], fileName, { type: EXPORT_MIME[options.format] })
        if (navigator.canShare?.({ files: [file] })) {
            try {
                await navigator.share({ files: [file] })
                return { fileName }
            } catch (error) {
                // User closed the share sheet — not a failure.
                if ((error as Error).name === 'AbortError') return { fileName }
                // Share rejected (e.g. user activation expired) — fall through
                // to the anchor download below.
            }
        }
    }

    downloadBlob(blob, fileName)
    return { fileName }
}
