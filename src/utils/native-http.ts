// Native-transport fallback for API requests the WebView can't complete.
// The edge in front of api.peanut.me rejects Android WebView GETs at the
// TLS-fingerprint level (PEANUT-UI-R5F) — fetch can only surface that as an
// opaque TypeError, since the block response carries no CORS headers.
// CapacitorHttp.request() runs on the OS HTTP client instead: no browser
// fingerprint, no Origin/X-Requested-With, no CORS. The plugin is registered
// natively regardless of the `CapacitorHttp.enabled` config flag — that flag
// only governs the fetch/XHR patch (the R44 interceptor proxy stays off).

import { PEANUT_API_URL } from '@/constants/general.consts'
import { isCapacitor } from './capacitor'

export function canUseNativeHttp(url: string, options: RequestInit = {}): boolean {
    if (!isCapacitor()) return false
    if (!url.startsWith(PEANUT_API_URL)) return false
    // Only JSON/text bodies survive the bridge; FormData and binary bodies keep
    // the WebView path (multipart uploads are POSTs, which the edge lets through).
    if (options.body != null && typeof options.body !== 'string') return false
    return true
}

export async function nativeHttpRequest(url: string, options: RequestInit = {}, timeoutMs: number): Promise<Response> {
    const { CapacitorHttp } = await import('@capacitor/core')

    const response = await CapacitorHttp.request({
        url,
        method: (options.method || 'GET').toUpperCase(),
        headers: Object.fromEntries(new Headers(options.headers as HeadersInit | undefined).entries()),
        data: typeof options.body === 'string' ? options.body : undefined,
        connectTimeout: timeoutMs,
        readTimeout: timeoutMs,
        responseType: 'text',
    })

    if (!response.status) {
        throw new TypeError('native http transport returned no status')
    }

    const text = typeof response.data === 'string' ? response.data : JSON.stringify(response.data ?? null)
    // Response() throws if these statuses carry a body
    const body = response.status === 204 || response.status === 205 || response.status === 304 ? null : text
    return new Response(body, { status: response.status, headers: response.headers })
}
