import type { CapturedNetworkRequest } from 'posthog-js'

const REDACTED = '[REDACTED QR DATA]'
const QR_KEYS = new Set(['qrcode', 'qrpayload', 'rawqrvalue', 'pixkey'])
const normalizedKey = (key: string) => key.toLowerCase().replace(/[_-]/g, '')

export function redactQrTelemetryString(value: string): string {
    let decoded = value
    for (let depth = 0; depth < 6; depth++) {
        if (
            /(?:[?&]|["']|\b)(?:qr[_-]?code|pix[_-]?key|qr[_-]?payload|raw[_-]?qr[_-]?value)["']?\s*[:=]/i.test(
                decoded
            ) ||
            /\/qr\/[^\s?#"']+/i.test(decoded) ||
            /\/qr\/?\?[^\s#]*\bcode=/i.test(decoded)
        )
            return REDACTED
        try {
            const next = decodeURIComponent(decoded.replace(/&amp;/gi, '&'))
            if (next === decoded) break
            if (depth === 5) return REDACTED
            decoded = next
        } catch {
            // A malformed escape elsewhere must not hide an encoded QR parameter.
            const next = decoded.replace(/%([\da-f]{2})/gi, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)))
            if (next === decoded) break
            if (depth === 5) return REDACTED
            decoded = next
        }
    }
    return value
}

export function redactQrTelemetry<T>(value: T): T {
    const seen = new WeakSet<object>()
    const scrub = (input: unknown, depth: number): unknown => {
        if (typeof input === 'string') return redactQrTelemetryString(input)
        if (!input || typeof input !== 'object') return input
        if (depth > 15) return REDACTED
        if (seen.has(input)) return input
        seen.add(input)
        for (const key of Object.keys(input)) {
            if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue
            const current = (input as Record<string, unknown>)[key]
            const next = QR_KEYS.has(normalizedKey(key)) ? REDACTED : scrub(current, depth + 1)
            if (next !== current)
                Object.defineProperty(input, key, { value: next, writable: true, enumerable: true, configurable: true })
        }
        return input
    }
    return scrub(value, 0) as T
}

export function maskQrReplayRequest(request: CapturedNetworkRequest): CapturedNetworkRequest {
    // Custom request masks bypass the SDK's default payload scrubber.
    const {
        requestBody: _requestBody,
        responseBody: _responseBody,
        requestHeaders: _requestHeaders,
        responseHeaders: _responseHeaders,
        ...metadata
    } = request
    return redactQrTelemetry(metadata)
}
