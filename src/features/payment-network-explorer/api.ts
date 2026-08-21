import { serverFetch } from '@/utils/api-fetch'
import { buildGraphEndpoint } from './query'
import type { ExplorerGraphResponse } from './types'

const REQUEST_TIMEOUT_MS = 30_000

export class PaymentNetworkApiError extends Error {
    constructor(
        message: string,
        readonly status: number,
        readonly code?: string
    ) {
        super(message)
        this.name = 'PaymentNetworkApiError'
    }
}

function errorMessage(status: number): string {
    // The endpoint never 401s: an expired or missing session also surfaces as 403.
    if (status === 403) return 'Your signed-in account does not have access to this explorer.'
    return 'The live payment network is unavailable. Try again.'
}

// serverFetch discards caller AbortSignals (it fetches with its own timeout
// controller) and never rethrows AbortError: its internal timeout surfaces as
// ConnectionTimeoutError. So no signal parameter — cancellation is not possible.
export async function fetchPaymentNetwork(topNodes: number): Promise<ExplorerGraphResponse> {
    try {
        const response = await serverFetch(buildGraphEndpoint(topNodes), {
            method: 'GET',
            cache: 'no-store',
            timeoutMs: REQUEST_TIMEOUT_MS,
        })
        if (!response.ok) {
            throw new PaymentNetworkApiError(errorMessage(response.status), response.status)
        }
        return (await response.json()) as ExplorerGraphResponse
    } catch (error) {
        if (error instanceof PaymentNetworkApiError) throw error
        if (error instanceof Error && error.name === 'ConnectionTimeoutError') {
            throw new PaymentNetworkApiError('The graph request timed out. Try fewer top users.', 408, 'TIMEOUT')
        }
        throw new PaymentNetworkApiError(errorMessage(503), 503, 'NETWORK_ERROR')
    }
}
