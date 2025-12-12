import { PEANUT_API_URL } from '@/constants'
import { fetchWithSentry } from '@/utils/sentry.utils'
import Cookies from 'js-cookie'
import type { Address } from 'viem'

export type QrPaymentType = 'STATIC' | 'DYNAMIC' | 'USER_SPECIFIED'

export interface SimpleFiQrPaymentRequest {
    type: QrPaymentType
    merchantSlug?: string
    currencyAmount?: string
    currency?: string
    simplefiRequestId?: string
}

export interface SimpleFiQrPaymentResponse {
    id: string
    usdAmount: string
    currency: string
    currencyAmount: string
    price: string
    address: Address
}

export type SimpleFiErrorCode =
    | 'ORDER_NOT_READY'
    | 'PAYMENT_NOT_PENDING'
    | 'NO_ARBITRUM_TRANSACTION'
    | 'MISSING_MERCHANT_SLUG'
    | 'MISSING_REQUEST_ID'
    | 'MISSING_PARAMETERS'
    | 'NO_MERCHANT_FOUND'
    | 'INVALID_TYPE'
    | 'UNEXPECTED_ERROR'

export interface SimpleFiQrPaymentError {
    error: SimpleFiErrorCode
    message: string
}

const ERROR_MESSAGES: Record<SimpleFiErrorCode, string> = {
    ORDER_NOT_READY: "Please notify the cashier that you're ready to pay",
    PAYMENT_NOT_PENDING: 'This payment has expired or been completed',
    NO_ARBITRUM_TRANSACTION: 'Payment method not supported',
    MISSING_MERCHANT_SLUG: 'Invalid merchant QR code',
    MISSING_REQUEST_ID: 'Invalid payment request',
    MISSING_PARAMETERS: 'Missing required payment information',
    NO_MERCHANT_FOUND: 'Merchant not found. Please use the standard payment option',
    INVALID_TYPE: 'Invalid payment type',
    UNEXPECTED_ERROR: 'Unable to process payment. Please try again',
}

export const simplefiApi = {
    initiateQrPayment: async (data: SimpleFiQrPaymentRequest): Promise<SimpleFiQrPaymentResponse> => {
        const response = await fetchWithSentry(`${PEANUT_API_URL}/simplefi/qr-pay`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${Cookies.get('jwt-token')}`,
            },
            body: JSON.stringify(data),
        })

        if (!response.ok) {
            const errorData = (await response.json().catch(() => ({}))) as SimpleFiQrPaymentError
            const errorCode = errorData.error || 'UNEXPECTED_ERROR'
            const userMessage = ERROR_MESSAGES[errorCode] || ERROR_MESSAGES.UNEXPECTED_ERROR
            throw new Error(userMessage)
        }

        return response.json()
    },
}
