import { PEANUT_API_URL } from '@/constants'
import { CreateChargeRequest, PaymentCreationResponse, TCharge, TRequestChargeResponse } from './services.types'

export const chargesApi = {
    create: async (data: CreateChargeRequest): Promise<TCharge> => {
        const response = await fetch(`/api/proxy/charges`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        })

        if (!response.ok) {
            throw new Error(`Failed to create charge: ${response.statusText}`)
        }

        return response.json()
    },

    get: async (id: string): Promise<TRequestChargeResponse> => {
        const response = await fetch(`${PEANUT_API_URL}/request-charges/${id}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        })

        if (!response.ok) {
            throw new Error(`Failed to fetch charge: ${response.statusText}`)
        }

        return response.json()
    },

    createPayment: async ({
        chargeId,
        chainId,
        hash,
        tokenAddress,
    }: {
        chargeId: string
        chainId: string
        hash: string
        tokenAddress: string
    }): Promise<PaymentCreationResponse> => {
        const response = await fetch(`/api/proxy/charges/${chargeId}/payments`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                chainId,
                hash,
                tokenAddress,
            }),
        })

        if (!response.ok) {
            throw new Error(`Failed to create payment: ${response.statusText}`)
        }

        return response.json()
    },
}
