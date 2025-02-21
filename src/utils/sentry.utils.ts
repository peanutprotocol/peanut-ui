import * as Sentry from '@sentry/nextjs'

import { JSONValue } from '../interfaces/interfaces'

const getErrorLevelFromStatus = (status: number): Sentry.SeverityLevel => {
    if (status >= 500) return 'error'
    if (status >= 400) return 'warning'
    return 'info'
}

export const fetchWithSentry = async (url: string, options: RequestInit = {}): Promise<Response> => {
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
    try {
        const response = await fetch(url, options)

        if (!response.ok) {
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
                        requestHeaders: options.headers || {},
                        requestBody: options.body || null,
                        status: response.status,
                        response: errorContent,
                    },
                })
            })
        }

        return response
    } catch (error: unknown) {
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
                    requestHeaders: options.headers || {},
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
