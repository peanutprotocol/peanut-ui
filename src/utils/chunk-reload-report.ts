import posthog from 'posthog-js'
import { CHUNK_RELOAD_REPORT_KEY } from '@/utils/chunk-error-recovery'
import { captureMessage, withScope } from '@/utils/sentry-lazy'

export function reportChunkReloadRecovery(): void {
    if (typeof window === 'undefined') return

    let raw: string | null
    try {
        raw = sessionStorage.getItem(CHUNK_RELOAD_REPORT_KEY)
        if (raw === null) return
        sessionStorage.removeItem(CHUNK_RELOAD_REPORT_KEY)
    } catch {
        return
    }

    let marker: unknown
    try {
        marker = JSON.parse(raw)
    } catch {
        return
    }
    if (!marker || typeof marker !== 'object' || Array.isArray(marker)) return
    const { at, path, source, message } = marker as Record<string, unknown>
    if (
        typeof at !== 'number' ||
        !Number.isFinite(at) ||
        typeof path !== 'string' ||
        (source !== 'inline' && source !== 'boundary') ||
        typeof message !== 'string'
    )
        return

    const reloadMs = Date.now() - at
    if (reloadMs > 300_000) return

    try {
        withScope((scope) => {
            scope.setFingerprint(['chunk-reload-recovered'])
            scope.setTag('chunk_reload.source', source)
            scope.setTag('chunk_reload.path', path)
            scope.setExtra('message', message)
            scope.setExtra('seconds_elapsed', reloadMs / 1000)
            captureMessage('Chunk load error recovered by reload', 'warning')
        })
    } catch {}
    try {
        posthog.capture('chunk_reload_recovered', { source, path, error_message: message, reload_ms: reloadMs })
    } catch {}
}
