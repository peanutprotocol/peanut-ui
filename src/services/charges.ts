import { fetchWithSentry } from '@/utils/sentry.utils'
import { jsonParse } from '@/utils/general.utils'
import Cookies from 'js-cookie'
import {
    type TRequestChargeResponse,
    type PaymentCreationResponse,
    type TCharge,
    type CreateChargeRequest,
} from './services.types'
import { PEANUT_API_URL } from '@/constants/general.consts'

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

        const response = await fetchWithSentry(`/api/proxy/withFormData/charges`, {
            method: 'POST',
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
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${Cookies.get('jwt-token')}`,
            },
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
    }: {
        chargeId: string
        chainId: string
        hash: string
        tokenAddress: string
        payerAddress: string
        sourceChainId?: string
        sourceTokenAddress?: string
        sourceTokenSymbol?: string
    }): Promise<PaymentCreationResponse> => {
        const response = await fetchWithSentry(`/api/proxy/post/charges/${chargeId}/payments`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                chainId,
                hash,
                tokenAddress,
                payerAddress,
                sourceChainId,
                sourceTokenAddress,
                sourceTokenSymbol,
            }),
        })

        if (!response.ok) {
            throw new Error(`Failed to create payment: ${response.statusText}`)
        }

        return response.json()
    },
}
