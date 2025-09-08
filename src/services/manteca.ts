import { PEANUT_API_URL } from '@/constants'
import { fetchWithSentry } from '@/utils'
import Cookies from 'js-cookie'
import { Address } from 'viem'

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

export const mantecaApi = {
    initiateQrPayment: async (data: QrPaymentRequest): Promise<QrPaymentResponse> => {
        const response = await fetchWithSentry(`${PEANUT_API_URL}/manteca/qr-payment`, {
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
}
