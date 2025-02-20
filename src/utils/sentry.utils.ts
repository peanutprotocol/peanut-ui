import * as Sentry from '@sentry/nextjs'

import { JSONValue } from '../interfaces/interfaces'

const getErrorLevelFromStatus = (status: number): Sentry.SeverityLevel => {
    if (status >= 500) return 'error'
    if (status >= 400) return 'warning'
    return 'info'
}

export const fetchWithSentry = async (url: string, options: RequestInit = {}): Promise<Response> => {
    try {
        const response = await fetch(url, options)

        if (!response.ok) {
            let errorContent: JSONValue
            try {
                errorContent = await response.clone().json()
            } catch {
                errorContent = await response.clone().text()
            }

            Sentry.captureMessage(`Fetch failed: ${response.status}`, {
                level: getErrorLevelFromStatus(response.status),
                extra: {
                    url,
                    method: options.method || 'GET',
                    requestHeaders: options.headers || {},
                    requestBody: options.body || null,
                    status: response.status,
                    response: errorContent,
                },
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
        throw error
    }
}
