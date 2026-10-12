import { AccountType } from '@/interfaces/interfaces'
import { serverFetch } from '@/utils/api-fetch'

export interface ExchangeRateResponse {
    from: string
    to: string
    midmarket_rate: string
    buy_rate: string
    sell_rate: string
    updated_at: string
}

export type ExchangeRateFailure = 'timeout' | 'network' | 'http' | 'invalid_rate'

/**
 * Fetch the current exchange rate for a given bank account type.
 *
 * This calls the `/bridge/exchange-rate` API endpoint.
 *
 * @param accountType - The type of bank account ('iban', 'us', 'clabe').
 * @param options.callerReportsFailures - The caller files the failure report; the fetch layer only leaves a breadcrumb.
 * @returns Either the successful response data, or an error with its status and failure kind.
 */
export async function getExchangeRate(
    accountType: AccountType,
    options: { callerReportsFailures?: boolean } = {}
): Promise<{ data?: ExchangeRateResponse; error?: string; status?: number; failure?: ExchangeRateFailure }> {
    try {
        const response = await serverFetch(`/bridge/exchange-rate?accountType=${accountType}`, {
            method: 'GET',
            ...options,
        })

        // A non-JSON body (an edge error page) is still an HTTP failure with a status, not a transport one.
        const data = await response.json().catch(() => undefined)

        if (!response.ok) {
            return { error: data?.error || 'Failed to fetch exchange rate.', status: response.status, failure: 'http' }
        }
        if (!data) {
            return { error: 'Invalid exchange rate response.', status: response.status, failure: 'invalid_rate' }
        }

        return { data }
    } catch (error) {
        // apiFetch (or the caller, with callerReportsFailures) records the
        // failure; a second console exception here adds no diagnostic context.
        console.warn('Error calling get exchange rate API:', error)
        const failure = error instanceof Error && error.name === 'ConnectionTimeoutError' ? 'timeout' : 'network'
        if (error instanceof Error) {
            return { error: error.message, failure }
        }
        return { error: 'An unexpected error occurred.', failure }
    }
}
