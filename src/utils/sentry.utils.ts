import * as Sentry from '@sentry/nextjs'

import { type JSONValue } from '../interfaces/interfaces'

/**
 * Endpoint + status combinations to skip reporting.
 * These are expected responses, not errors.
 * Pattern can be a string (exact match) or regex.
 */
const SKIP_REPORTING: Array<{ pattern: string | RegExp; statuses: number[] }> = [
    { pattern: /get-user-from-cookie/, statuses: [400, 401, 403, 404] },
    { pattern: /users/, statuses: [400, 401, 403, 404] },
    { pattern: /perks/, statuses: [400, 401, 403, 404] },
    { pattern: /qr-payment\/init/, statuses: [400] },
]

/**
 * Check if this endpoint + status combo should skip Sentry reporting
 */
function shouldSkipReporting(url: string, status: number): boolean {
    for (const rule of SKIP_REPORTING) {
        const matches = typeof rule.pattern === 'string' ? url.includes(rule.pattern) : rule.pattern.test(url)

        if (matches && rule.statuses.includes(status)) {
            return true
        }
    }
    return false
}

/** Use configured fetch timeout or default to 10s
 * We use 10s because vercel function timout is 15s and this function
 * can be called in that context, and we preffer to have control over
 * the error message and handling
 */
const DEFAULT_TIMEOUT_MS =
    process.env.NEXT_PUBLIC_FETCH_TIMEOUT_MS && !isNaN(parseInt(process.env.NEXT_PUBLIC_FETCH_TIMEOUT_MS, 10))
        ? parseInt(process.env.NEXT_PUBLIC_FETCH_TIMEOUT_MS, 10)
        : 10000

const getErrorLevelFromStatus = (status: number): Sentry.SeverityLevel => {
    if (status >= 500) return 'error'
    if (status >= 400) return 'warning'
    return 'info'
}

const sanitizeHeaders = (headers: any): any => {
    if (!headers) return headers

    const sanitized = { ...headers }
    const sensitiveHeaders = ['authorization', 'cookie', 'x-auth-token', 'api-key']

    for (const key of Object.keys(sanitized)) {
        if (sensitiveHeaders.includes(key.toLowerCase())) {
            sanitized[key] = '[REDACTED]'
        }
    }

    return sanitized
}

export const fetchWithSentry = async (
    url: string,
    options: RequestInit = {},
    timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<Response> => {
    // Sanitize URL for fingerprinting by replacing IDs with placeholders
    const sanitizeUrl = (url: string) => {
        return (
            url
                // Replace numeric IDs in path
                .replace(/\/\d+(?=\/|$)/g, '/{id}')
                // Replace UUIDs in path
                .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?=\/|$)/gi, '/{uuid}')
                // Replace numeric IDs in query params
                .replace(/([?&][^=&]*=)\d+/g, '$1{id}')
        )
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal,
        })

        clearTimeout(timeoutId)

        if (!response.ok) {
            console.warn(`Request to ${url} failed with status ${response.status}`)

            // Skip Sentry reporting for expected error responses
            if (!shouldSkipReporting(url, response.status)) {
                let errorContent: JSONValue
                try {
                    errorContent = await response.clone().json()
                } catch {
                    errorContent = await response.clone().text()
                }
                const method = options.method || 'GET'
                Sentry.withScope((scope) => {
                    // Set fingerprint to group similar errors
                    scope.setFingerprint([method, sanitizeUrl(url), String(response.status)])

                    Sentry.captureMessage(`${method} to ${url} failed with status ${response.status}`, {
                        level: getErrorLevelFromStatus(response.status),
                        extra: {
                            url,
                            method,
                            requestHeaders: sanitizeHeaders(options.headers || {}),
                            requestBody: options.body || null,
                            status: response.status,
                            response: errorContent,
                        },
                    })
                })
            }
        }

        return response
    } catch (error: unknown) {
        clearTimeout(timeoutId)
        console.error(error)

        if (error instanceof Error && error.name === 'AbortError') {
            const timeoutError = new Error(`Request to ${url} timed out after ${timeoutMs}ms`)

            Sentry.withScope((scope) => {
                scope.setFingerprint(['timeout', sanitizeUrl(url), options.method || 'GET'])

                Sentry.captureException(timeoutError, {
                    level: 'error',
                    extra: {
                        url,
                        method: options.method || 'GET',
                        timeoutMs,
                        requestHeaders: sanitizeHeaders(options.headers || {}),
                        requestBody: options.body || null,
                    },
                })
            })

            throw timeoutError
        }

        let errorMessage: string
        let errorName: string
        let errorStack: string | undefined

        if (error instanceof Error) {
            errorMessage = error.message
            errorName = error.name
            errorStack = error.stack
        } else {
            errorMessage = (error as any).toString()
            errorName = 'Unknown Error'
        }

        Sentry.withScope((scope) => {
            // Set fingerprint for network errors
            scope.setFingerprint(['network-error', sanitizeUrl(url), options.method || 'GET'])

            Sentry.captureException(error, {
                extra: {
                    url,
                    method: options.method || 'GET',
                    requestHeaders: sanitizeHeaders(options.headers || {}),
                    requestBody: options.body || null,
                    errorMessage,
                    errorName,
                    errorStack,
                },
            })
        })

        throw error
    }
}
