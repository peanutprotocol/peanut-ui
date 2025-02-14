import { PEANUT_API_URL } from '@/constants'
import { CreateRequestRequest, TRequest } from './services.types'

export const requestsApi = {
    create: async (data: CreateRequestRequest): Promise<TRequest> => {
        const formData = new FormData()

        Object.entries(data).forEach(([key, value]) => {
            if (value !== undefined) {
                formData.append(key, value)
            }
        })

        const response = await fetch('/api/proxy/withFormData/requests', {
            method: 'POST',
            body: formData,
        })

        if (!response.ok) {
            throw new Error(`Failed to create request: ${response.statusText}`)
        }

        return response.json()
    },

    get: async (id: string): Promise<TRequest> => {
        const response = await fetch(`/api/proxy/requests/${id}`)
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
    }): Promise<TRequest | null> => {
        const queryParams = new URLSearchParams()
        Object.entries(params).forEach(([key, value]) => {
            if (value) queryParams.append(key, value)
        })

        const response = await fetch(`${PEANUT_API_URL}/requests?${queryParams.toString()}`)
        if (!response.ok) {
            if (response.status === 404) {
                return null
            }
            throw new Error('Failed to fetch requests')
        }
        return response.json()
    },
}
