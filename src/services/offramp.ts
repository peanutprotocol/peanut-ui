import Cookies from 'js-cookie'
import { TCreateOfframpRequest, TCreateOfframpResponse } from './services.types'
import { fetchWithSentry } from '@/utils'

export const offrampApi = {
    create: async (data: TCreateOfframpRequest): Promise<TCreateOfframpResponse> => {
        const token = Cookies.get('jwt-token')
        if (!token) {
            throw new Error('Authentication token not found')
        }
        const response = await fetchWithSentry('/api/proxy/bridge/offramp/create', {
            method: 'POST',
            body: JSON.stringify(data),
            headers: {
                'Content-Type': 'application/json',
                authorization: `Bearer ${token}`,
            },
        })

        return response.json()
    },
}
