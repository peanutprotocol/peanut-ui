import { fetchWithSentry } from '@/utils/sentry.utils'
import { jsonParse } from '@/utils/general.utils'
import {
    type TRequestChargeResponse,
    type PaymentCreationResponse,
    type TCharge,
    type CreateChargeRequest,
} from './services.types'
import { PEANUT_API_URL } from '@/constants/general.consts'
import { getAuthToken } from '@/utils/auth-token'
import { apiFetch, serverFetch } from '@/utils/api-fetch'

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

        const headers: Record<string, string> = {}
        const token = getAuthToken()
        if (token) headers['Authorization'] = `Bearer ${token}`
        const response = await fetchWithSentry(`${PEANUT_API_URL}/charges`, {
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
        const response = await serverFetch(`/request-charges/${id}`, {
            method: 'GET',
        })

        if (!response.ok) {
            throw new Error(`Failed to fetch charge: ${response.statusText}`)
        }

        return jsonParse(await response.text()) as TRequestChargeResponse
    },

    cancel: async (id: string): Promise<void> => {
        const response = await serverFetch(`/charges/${id}`, {
            method: 'DELETE',
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
        // NOTE: called AFTER the on-chain payment tx already mined. A timeout
        // here is NOT safe to blindly retry from the wallet side (re-running
        // the parent handler would re-fire sendMoney and double-pay). Bump
        // well above the 10s default so the BE has time to write the payment
        // row + run notifications. Matches the offramp `confirmOfframp`
        // pattern (peanut-ui #2147). Callers MUST additionally render a
        // post-on-chain "processing" state instead of a Retry button —
        // realised via the flow-context `txHash` (set BEFORE this call by
        // each flow's `setTxHash`), consumed by every input/confirm view.
        const response = await apiFetch(`/charges/${chargeId}/payments`, {
            method: 'POST',
            body: JSON.stringify({
                chainId,
                hash,
                tokenAddress,
                payerAddress,
                sourceChainId,
                sourceTokenAddress,
                sourceTokenSymbol,
            }),
            timeoutMs: 60_000,
        })

        if (!response.ok) {
            throw new Error(`Failed to create payment: ${response.statusText}`)
        }

        return response.json()
    },
}
