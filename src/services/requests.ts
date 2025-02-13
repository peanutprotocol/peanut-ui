import { CreateRequestRequest } from './services.types'

export const requestsApi = {
    create: async (data: CreateRequestRequest): Promise<PaymentRequest> => {
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

    get: async (id: string): Promise<PaymentRequest> => {
        const response = await fetch(`/api/proxy/requests/${id}`)
        if (!response.ok) {
            throw new Error(`Failed to fetch request: ${response.statusText}`)
        }
        return response.json()
    },
}
