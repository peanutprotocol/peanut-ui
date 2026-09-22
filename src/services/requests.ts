import {
    type CreateRequestRequest,
    type RequestDepositInstructions,
    type RequestPayAmounts,
    type TRequestResponse,
} from './services.types'
import { serverFetch } from '@/utils/api-fetch'
import { apiErrorFromResponse } from './api-error'
import { jsonStringify } from '@/utils/general.utils'

export const requestsApi = {
    create: async (data: CreateRequestRequest): Promise<TRequestResponse> => {
        const response = await serverFetch('/requests', {
            method: 'POST',
            body: jsonStringify(data),
        })

        // The error keeps the API's `code`: a request asked in a fiat currency
        // fails in ways the screen explains differently (no rate, bad amount).
        if (!response.ok) {
            throw await apiErrorFromResponse(response, `Failed to create request: ${response.statusText}`)
        }

        return response.json()
    },

    update: async (id: string, data: Partial<CreateRequestRequest>): Promise<TRequestResponse> => {
        const response = await serverFetch(`/requests/${id}`, {
            method: 'PATCH',
            body: jsonStringify(data),
        })

        if (!response.ok) {
            throw new Error(`Failed to update request: ${response.statusText}`)
        }

        return response.json()
    },

    get: async (uuid: string): Promise<TRequestResponse> => {
        const response = await serverFetch(`/requests/${uuid}`, {
            method: 'GET',
        })
        if (!response.ok) {
            throw new Error(`Failed to fetch request: ${response.statusText}`)
        }
        return response.json()
    },

    /**
     * The bank details a payer can send this request's amount to.
     *
     * 404 is an ordinary answer, not a failure: the requester did not opt in,
     * or holds no account the money could arrive in. The backend answers the
     * same 404 for a request that does not exist, so the opt-in cannot be
     * probed — and `null` here means the same thing to the screen either way.
     */
    depositInstructions: async (uuid: string, currency?: string): Promise<RequestDepositInstructions | null> => {
        // `currency` picks which of the requester's accounts to return. An API
        // that predates it ignores the parameter and returns the first one.
        const query = currency ? `?currency=${encodeURIComponent(currency)}` : ''
        const response = await serverFetch(`/requests/${uuid}/deposit-instructions${query}`, { method: 'GET' })
        if (response.status === 404) return null
        if (!response.ok) {
            throw new Error(`Failed to fetch deposit instructions: ${response.statusText}`)
        }
        return response.json()
    },

    /**
     * What the request still needs on each rail, in that rail's currency.
     *
     * `null` for a 404: the request is gone, or the API predates the route. The
     * pay screen then shows its rails with no per-rail amounts, as it did
     * before the route existed.
     */
    payAmounts: async (uuid: string): Promise<RequestPayAmounts | null> => {
        const response = await serverFetch(`/requests/${uuid}/pay-amounts`, { method: 'GET' })
        if (response.status === 404) return null
        if (!response.ok) {
            throw new Error(`Failed to fetch pay amounts: ${response.statusText}`)
        }
        return response.json()
    },

    search: async (params: {
        recipient: string
        tokenAmount?: string
        tokenAddress?: string
        chainId?: string
    }): Promise<TRequestResponse | null> => {
        const queryParams = new URLSearchParams()
        Object.entries(params).forEach(([key, value]) => {
            if (value) queryParams.append(key, value)
        })

        const response = await serverFetch(`/requests?${queryParams.toString()}`, {
            method: 'GET',
        })
        if (!response.ok) {
            if (response.status === 404) {
                return null
            }
            throw new Error('Failed to fetch requests')
        }
        return response.json()
    },

    close: async (uuid: string): Promise<TRequestResponse> => {
        const response = await serverFetch(`/requests/${uuid}`, {
            method: 'DELETE',
        })
        if (!response.ok) {
            throw new Error(`Failed to close request: ${response.statusText}`)
        }
        return response.json()
    },
}
