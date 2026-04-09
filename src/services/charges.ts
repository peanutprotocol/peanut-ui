import { fetchWithSentry } from '@/utils/sentry.utils'
import { jsonParse } from '@/utils/general.utils'
import {
    type TRequestChargeResponse,
    type PaymentCreationResponse,
    type TCharge,
    type CreateChargeRequest,
} from './services.types'
import { PEANUT_API_URL } from '@/constants/general.consts'
import { isCapacitor } from '@/utils/capacitor'
import { getAuthHeaders, getAuthToken } from '@/utils/auth-token'
import { apiFetch } from '@/utils/api-fetch'

export const chargesApi = {
    create: async (data: CreateChargeRequest): Promise<TCharge> => {
        const formData = new FormData()

        Object.entries(data).forEach(([key, value]) => {
            if (value !== undefined) {
                // check if the value is an object and not a File/Blob
                if (typeof value === 'object' && !(value instanceof File) && !(value instanceof Blob)) {
                    formData.append(key, JSON.stringify(value))
                } else {
                    formData.append(key, value)
                }
            }
        })

        const chargeUrl = isCapacitor() ? `${PEANUT_API_URL}/charges` : '/api/proxy/withFormData/charges'
        const headers: Record<string, string> = {}
        const token = getAuthToken()
        if (token) headers['Authorization'] = `Bearer ${token}`
        const response = await fetchWithSentry(chargeUrl, {
            method: 'POST',
            headers,
            body: formData,
        })

        if (!response.ok) {
            throw new Error(`Failed to create charge: ${response.statusText}`)
        }

        return response.json()
    },

    get: async (id: string): Promise<TRequestChargeResponse> => {
        const response = await fetchWithSentry(`${PEANUT_API_URL}/request-charges/${id}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        })

        if (!response.ok) {
            throw new Error(`Failed to fetch charge: ${response.statusText}`)
        }

        return jsonParse(await response.text()) as TRequestChargeResponse
    },

    cancel: async (id: string): Promise<void> => {
        const response = await fetchWithSentry(`${PEANUT_API_URL}/charges/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders(),
        })

        if (!response.ok) {
            throw new Error(`Failed to cancel charge: ${response.statusText}`)
        }
    },

    createPayment: async ({
        chargeId,
        chainId,
        hash,
        tokenAddress,
        payerAddress,
        sourceChainId,
        sourceTokenAddress,
        sourceTokenSymbol,
        squidQuoteId,
    }: {
        chargeId: string
        chainId: string
        hash: string
        tokenAddress: string
        payerAddress: string
        sourceChainId?: string
        sourceTokenAddress?: string
        sourceTokenSymbol?: string
        squidQuoteId?: string
    }): Promise<PaymentCreationResponse> => {
        const response = await apiFetch(`/charges/${chargeId}/payments`, `/api/proxy/charges/${chargeId}/payments`, {
            method: 'POST',
            body: JSON.stringify({
                chainId,
                hash,
                tokenAddress,
                payerAddress,
                sourceChainId,
                sourceTokenAddress,
                sourceTokenSymbol,
                squidQuoteId,
            }),
        })

        if (!response.ok) {
            throw new Error(`Failed to create payment: ${response.statusText}`)
        }

        return response.json()
    },
}
