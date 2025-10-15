import { PEANUT_API_URL } from '@/constants'
import { CreateRequestRequest, TRequestResponse } from './services.types'
import { fetchWithSentry, jsonStringify } from '@/utils'
import Cookies from 'js-cookie'

export const requestsApi = {
    create: async (data: CreateRequestRequest): Promise<TRequestResponse> => {
        const response = await fetchWithSentry(`${PEANUT_API_URL}/requests`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${Cookies.get('jwt-token')}`,
            },
            body: jsonStringify(data),
        })

        if (!response.ok) {
            let errorMessage = `Failed to create request: ${response.statusText}`

            try {
                const errorData = await response.json()
                if (errorData.error) {
                    errorMessage = errorData.error
                }
            } catch (parseError) {
                // If we can't parse the response, use the default error message
                console.warn('Could not parse error response:', parseError)
            }

            throw new Error(errorMessage)
        }

        return response.json()
    },

    update: async (id: string, data: Partial<CreateRequestRequest>): Promise<TRequestResponse> => {
        const response = await fetchWithSentry(`${PEANUT_API_URL}/requests/${id}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${Cookies.get('jwt-token')}`,
            },
            body: jsonStringify(data),
        })

        if (!response.ok) {
            throw new Error(`Failed to update request: ${response.statusText}`)
        }

        return response.json()
    },

    get: async (uuid: string): Promise<TRequestResponse> => {
        const response = await fetchWithSentry(`${PEANUT_API_URL}/requests/${uuid}`)
        if (!response.ok) {
            throw new Error(`Failed to fetch request: ${response.statusText}`)
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

        const response = await fetchWithSentry(`${PEANUT_API_URL}/requests?${queryParams.toString()}`)
        if (!response.ok) {
            if (response.status === 404) {
                return null
            }
            throw new Error('Failed to fetch requests')
        }
        return response.json()
    },

    close: async (uuid: string): Promise<TRequestResponse> => {
        const token = Cookies.get('jwt-token')
        if (!token) {
            throw new Error('Authentication token not found. Please log in again.')
        }
        const response = await fetchWithSentry(`${PEANUT_API_URL}/requests/${uuid}`, {
            method: 'DELETE',
            headers: {
                Authorization: `Bearer ${token}`,
            },
        })
        if (!response.ok) {
            throw new Error(`Failed to close request: ${response.statusText}`)
        }
        return response.json()
    },
}
