import { PEANUT_API_URL } from '@/constants'
import { CreateRequestRequest, TRequestResponse } from './services.types'
import { fetchWithSentry } from '@/utils'

export const requestsApi = {
    create: async (data: CreateRequestRequest): Promise<TRequestResponse> => {
        const formData = new FormData()

        Object.entries(data).forEach(([key, value]) => {
            if (value !== undefined) {
                formData.append(key, value)
            }
        })

        const response = await fetchWithSentry('/api/proxy/withFormData/requests', {
            method: 'POST',
            body: formData,
        })

        if (!response.ok) {
            throw new Error(`Failed to create request: ${response.statusText}`)
        }

        return response.json()
    },

    update: async (id: string, data: Partial<CreateRequestRequest>): Promise<TRequestResponse> => {
        const formData = new FormData()

        Object.entries(data).forEach(([key, value]) => {
            if (value !== undefined) {
                formData.append(key, value)
            }
        })

        const response = await fetchWithSentry(`/api/proxy/withFormData/requests/${id}`, {
            method: 'PATCH',
            body: formData,
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
}
