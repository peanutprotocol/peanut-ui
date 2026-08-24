import { fetchWithSentry } from '@/utils/sentry.utils'
import { jsonParse } from '@/utils/general.utils'
import {
    type TRequestChargeResponse,
    type PaymentCreationResponse,
    type TCharge,
    type CreateChargeRequest,
} from './services.types'
import { PEANUT_API_URL } from '@/constants/general.consts'
import { getAuthToken, authReady } from '@/utils/auth-token'
import { apiFetch, serverFetch } from '@/utils/api-fetch'
import { apiErrorFromResponse } from './api-error'
import { isDemoMode } from '@/utils/demo'

export const chargesApi = {
    create: async (data: CreateChargeRequest): Promise<TCharge> => {
        // This call bypasses callApi (multipart FormData via fetchWithSentry), so
        // the demo interceptor is invoked explicitly here. Lazy import keeps the
        // demo module out of this service's module graph on web/tests.
        if (isDemoMode()) {
            const { demoRespond } = await import('@/utils/demo-api')
            // pass the charge data so the demo store captures the real amount.
            return (await demoRespond('/charges', { method: 'POST', body: JSON.stringify(data) })).json()
        }

        /*
         * Multipart is used ONLY when a real file rides along. Everything else
         * goes as JSON through apiFetch so a tokenless native session (legacy
         * cookie-jar auth) gets the native-transport cookie fallback — FormData
         * can't cross the native bridge (see native-http.ts), so the multipart
         * path silently sent such POSTs with no auth at all.
         */
        const attachment: unknown = data.attachment
        const hasFileAttachment = attachment instanceof File || attachment instanceof Blob
        if (!hasFileAttachment) {
            const response = await apiFetch('/charges', {
                method: 'POST',
                body: JSON.stringify(data),
            })
            if (!response.ok) {
                throw await apiErrorFromResponse(response, 'Failed to create charge')
            }
            return response.json()
        }

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

        await authReady()
        const headers: Record<string, string> = {}
        const token = getAuthToken()
        if (token) headers['Authorization'] = `Bearer ${token}`
        const response = await fetchWithSentry(`${PEANUT_API_URL}/charges`, {
            method: 'POST',
            headers,
            body: formData,
        })

        if (!response.ok) {
            throw await apiErrorFromResponse(response, 'Failed to create charge')
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
        const response = await apiFetch(`/charges/${chargeId}/payments`, {
            method: 'POST',
            // The write the whole flow hinges on: funds have already moved
            // on-chain when this fires. The 20s default abort has fired while
            // the API had long since committed (Vercel proxy cold-start ate
            // the budget — TASK-19581), which reads as a failed withdrawal.
            // Give bookkeeping room to succeed instead of surfacing Retry.
            timeoutMs: 30_000,
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
