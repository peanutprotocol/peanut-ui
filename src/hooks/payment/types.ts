import type { PaymentCreationResponse, TRequestChargeResponse } from '@/services/services.types'

// Common types for all payment flows
export interface BasePaymentResult {
    success: boolean
    charge?: TRequestChargeResponse
    payment?: PaymentCreationResponse
    txHash?: string
    error?: string
}

export interface AttachmentOptions {
    message?: string
    rawFile?: File
}

export interface PaymentRecipient {
    identifier: string
    resolvedAddress: string
    recipientType?: 'ADDRESS' | 'ENS' | 'USERNAME'
}

// Flow-specific payload types
export interface DirectSendPayload {
    recipient: PaymentRecipient
    tokenAmount: string
    requestId?: string
    attachmentOptions?: AttachmentOptions
}

export interface AddMoneyPayload {
    tokenAmount: string
    fromChainId: string
    fromTokenAddress: string
    attachmentOptions?: AttachmentOptions
}

export interface WithdrawPayload {
    recipient: PaymentRecipient
    tokenAmount: string
    toChainId: string
    toTokenAddress: string
}

export interface RequestPayPayload {
    chargeId?: string
    requestId?: string
    tokenAmount: string
    recipient?: PaymentRecipient
    attachmentOptions?: AttachmentOptions
}
