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

/*
 * `timeoutMs` is a WALL-CLOCK bound on how long the caller waits, which is not
 * what CapacitorHttp's own options give us. `connectTimeout` and `readTimeout`
 * are separate phase limits, and on Android the read limit resets every time
 * more data arrives — so handing the same value to both bounds a slow request
 * at 2x, and a slow drip not at all. Every budget in this app is a promise
 * about the user's wait, so the await is raced against the clock.
 *
 * The underlying request is not cancelled: CapacitorHttp exposes no abort. It
 * is left to finish and its result discarded, exactly as an aborted `fetch`
 * leaves the server's work running — the caller has already stopped waiting,
 * which is the whole of what the budget promises.
 */
export async function nativeHttpRequest(url: string, options: RequestInit = {}, timeoutMs: number): Promise<Response> {
    const { CapacitorHttp } = await import('@capacitor/core')

    let expire: ReturnType<typeof setTimeout> | undefined
    const response = await Promise.race([
        CapacitorHttp.request({
            url,
            method: (options.method || 'GET').toUpperCase(),
            headers: Object.fromEntries(new Headers(options.headers as HeadersInit | undefined).entries()),
            data: typeof options.body === 'string' ? options.body : undefined,
            connectTimeout: timeoutMs,
            readTimeout: timeoutMs,
            responseType: 'text',
        }),
        new Promise<never>((_, reject) => {
            expire = setTimeout(
                // AbortError so fetchWithSentry classifies this as the timeout
                // it is, rather than as an opaque transport rejection.
                () => reject(Object.assign(new Error('native http timed out'), { name: 'AbortError' })),
                timeoutMs
            )
        }),
    ]).finally(() => clearTimeout(expire))

    if (!response.status) {
        throw new TypeError('native http transport returned no status')
    }

    const text = typeof response.data === 'string' ? response.data : JSON.stringify(response.data ?? null)
    // Response() throws if these statuses carry a body
    const body = response.status === 204 || response.status === 205 || response.status === 304 ? null : text
    return new Response(body, { status: response.status, headers: response.headers })
}
