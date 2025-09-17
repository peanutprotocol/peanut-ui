import { PEANUT_API_URL, PEANUT_API_KEY } from '@/constants'
import {
    MantecaDepositDetails,
    MantecaWithdrawData,
    MantecaWithdrawResponse,
    CreateMantecaOnrampParams,
} from '@/types/manteca.types'
import { fetchWithSentry } from '@/utils'
import Cookies from 'js-cookie'
import type { Address, Hash } from 'viem'

export interface QrPaymentRequest {
    qrCode: string
    amount?: string
}

export type QrPayment = {
    id: string
    externalId: string
    sessionId: string
    status: string
    currentStage: string
    stages: any[]
    type: 'QR3_PAYMENT' | 'PIX'
    details: {
        depositAddress: Address
        paymentAsset: string
        paymentAgainst: string
        paymentAgainstAmount: string
        paymentAssetAmount: string
        paymentPrice: string
        priceExpireAt: string
        merchant: {
            name: string
        }
    }
}

export type QrPaymentCharge = {
    uuid: string
    createdAt: string
    link: string
    chainId: string
    tokenAmount: string
    tokenAddress: string
    tokenDecimals: number
    tokenType: string
    tokenSymbol: string
}

export type QrPaymentLock = {
    code: string
    type: string
    companyId: string
    userId: string
    userNumberId: string
    userExternalId: string
    paymentRecipientName: string
    paymentRecipientLegalId: string
    paymentAssetAmount: string
    paymentAsset: string
    paymentPrice: string
    paymentAgainstAmount: string
    paymentAgainst: string
    expireAt: string
    creationTime: string
}

export type QrPaymentResponse =
    | {
          qrPayment: QrPayment
          charge: QrPaymentCharge
      }
    | { paymentLock: QrPaymentLock }

export type MantecaPrice = {
    ticker: string
    buy: string
    sell: string
    timestamp: string
    variation: {
        buy: {
            realtime: string
            daily: string
        }
        sell: {
            realtime: string
            daily: string
        }
    }
    effectiveBuy: string
    effectiveSell: string
}

export const mantecaApi = {
    initiateQrPayment: async (data: QrPaymentRequest): Promise<QrPaymentLock> => {
        const response = await fetchWithSentry(`${PEANUT_API_URL}/manteca/qr-payment/init`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${Cookies.get('jwt-token')}`,
            },
            body: JSON.stringify(data),
        })

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}))
            throw new Error(errorData.message || `QR payment failed: ${response.statusText}`)
        }

        return response.json()
    },
    completeQrPayment: async ({
        paymentLockCode,
        txHash,
    }: {
        paymentLockCode: string
        txHash: Hash
    }): Promise<QrPayment> => {
        const response = await fetchWithSentry(`${PEANUT_API_URL}/manteca/qr-payment/complete`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${Cookies.get('jwt-token')}`,
            },
            body: JSON.stringify({ paymentLockCode, txHash }),
        })

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}))
            throw new Error(errorData.message || `QR payment failed: ${response.statusText}`)
        }

        return response.json()
    },
    getPrices: async ({ asset, against }: { asset: string; against: string }): Promise<MantecaPrice> => {
        const response = await fetchWithSentry(`${PEANUT_API_URL}/manteca/prices?asset=${asset}&against=${against}`, {
            headers: {
                'Content-Type': 'application/json',
                'api-key': PEANUT_API_KEY,
            },
        })

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}))
            throw new Error(errorData.message || `Get prices failed: ${response.statusText}`)
        }

        return response.json()
    },
    initiateOnboarding: async (params: {
        returnUrl: string
        failureUrl?: string
        exchange?: string
    }): Promise<{ url: string }> => {
        const response = await fetchWithSentry(`${PEANUT_API_URL}/manteca/initiate-onboarding`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${Cookies.get('jwt-token')}`,
            },
            body: JSON.stringify(params),
        })

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}))
            throw new Error(errorData.message || `Failed to get onboarding URL`)
        }

        return response.json()
    },

    deposit: async (params: CreateMantecaOnrampParams): Promise<{ data?: MantecaDepositDetails; error?: string }> => {
        try {
            const response = await fetchWithSentry(`${PEANUT_API_URL}/manteca/deposit`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${Cookies.get('jwt-token')}`,
                    'api-key': 'DRdzuEiRvTtbFYKGahIdFUHuwhYzl1vo',
                },
                body: JSON.stringify({
                    usdAmount: params.usdAmount,
                    currency: params.currency,
                    chargeId: params.chargeId,
                }),
            })

            const data = await response.json()

            if (!response.ok) {
                console.log('error', response)
                return { error: data.error || 'Failed to create on-ramp transfer for guest.' }
            }

            return { data }
        } catch (error) {
            console.log('error', error)
            console.error('Error calling create manteca on-ramp API:', error)
            if (error instanceof Error) {
                return { error: error.message }
            }
            return { error: 'An unexpected error occurred.' }
        }
    },

    withdraw: async (data: MantecaWithdrawData): Promise<MantecaWithdrawResponse> => {
        try {
            const response = await fetchWithSentry(`${PEANUT_API_URL}/manteca/withdraw`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${Cookies.get('jwt-token')}`,
                },
                body: JSON.stringify(data),
            })

            const result = await response.json()
            if (!response.ok) {
                return { error: result.error || 'Failed to create manteca withdraw.' }
            }

            return { data: result }
        } catch (error) {
            console.log('error', error)
            console.error('Error calling create manteca withdraw API:', error)
            if (error instanceof Error) {
                return { error: error.message }
            }
            return { error: 'An unexpected error occurred.' }
        }
    },
}
