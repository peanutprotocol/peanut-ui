// common types

export type TStatus = 'NEW' | 'PENDING' | 'COMPLETED' | 'EXPIRED' | 'FAILED' | 'SIGNED' | 'SUCCESSFUL'

export interface TimelineEntry {
    status: TStatus
    time: string
}

interface FulfillmentPayment {
    uuid: string
    payerTransactionHash: string
    payerChainId: string
    paidTokenAddress: string
    payerAddress: string
    fulfillmentTransactionHash: string
    chargeUuid: string
    paidAmountInRequestedToken: string
    status: string
    reason: string | null
    createdAt: string
    verifiedAt: string | null
}

// requests service types
export interface CreateRequestRequest {
    chainId: string
    tokenAmount?: string
    recipientAddress: string
    trackId?: string
    reference?: string
    attachment?: File
    tokenType: string
    tokenAddress: string
    tokenDecimals: string
    tokenSymbol: string
}

export interface TRequestResponse {
    uuid: string
    chainId: string
    recipientAddress: string
    tokenAmount: string
    tokenAddress: string
    tokenDecimals: number
    tokenType: string
    tokenSymbol: string
    trackId?: string
    reference?: string
    attachmentUrl?: string
    createdAt: string
    updatedAt: string
    charges: ChargeEntry[]
    history: TRequestHistory[]
}

interface ChargeEntry {
    createdAt: string
    payments: Payment[]
    uuid: string
    link: string
    chainId: string
    tokenAmount: string
    tokenAddress: string
    tokenDecimals: number
    tokenType: string
    tokenSymbol: string
    updatedAt: string
    fulfillmentPayment: FulfillmentPayment | null
    timeline: TimelineEntry[]
    requestLink: {
        recipientAddress: string
        recipientAccount: {
            userId: string
            identifier: string
            type: string
            user: {
                username: string
            }
        }
        reference?: string
        attachmentUrl?: string | null
        trackId?: string | null
    }
}

// charges service types
export interface LocalPrice {
    amount: string
    currency: string
}

export interface RequestProps {
    chainId: string
    tokenAddress: string
    tokenType: string
    tokenSymbol: string
    tokenDecimals: number
    recipientAddress: string
}

export interface CreateChargeRequest {
    pricing_type: 'fixed_price'
    local_price: LocalPrice
    baseUrl: string
    requestId?: string
    requestProps: RequestProps
    attachment?: File
    reference?: string
}

export interface TCharge {
    data: {
        id: string
        code: string
        hosted_url: string
        created_at: string
        status?: string
    }
    warnings: string[]
}

// Payment object in charge details
export interface Payment {
    uuid: string
    chargeUuid: string
    payerTransactionHash: string
    payerChainId: string
    paidTokenAddress: string
    paidAmountInRequestedToken: string | null
    payerAddress: string | null
    fulfillmentTransactionHash: string | null
    status: TStatus
    reason: string | null
    createdAt: string
    verifiedAt: string | null
}

// Payment creation response
export interface PaymentCreationResponse {
    uuid: string
    paidTokenAddress: string
    payerChainId: string
    payerTransactionHash: string
    requestCharge: {
        uuid: string
        chainId: string
        createdAt: string
        tokenAddress: string
        tokenAmount: string
        tokenDecimals: number
        requestLink: {
            recipientAddress: string
        }
    }
}

export interface TRequestChargeResponse {
    uuid: string
    createdAt: string
    link: string
    chainId: string
    tokenAmount: string
    tokenAddress: string
    tokenDecimals: number
    tokenType: string
    tokenSymbol: string
    updatedAt: string
    payments: Payment[]
    fulfillmentPayment: FulfillmentPayment | null
    timeline: TimelineEntry[]
    requestLink: {
        recipientAddress: string
        reference?: string
        attachmentUrl?: string | null
        trackId?: string | null
    }
}

// create payment response
export interface PaymentResponse {
    uuid: string
    paidTokenAddress: string
    payerChainId: string
    payerTransactionHash: string
    requestCharge: {
        uuid: string
        chainId: string
        createdAt: string
        tokenAddress: string
        tokenAmount: string
        tokenDecimals: number
        requestLink: {
            recipientAddress: string
            reference?: string
            attachmentUrl?: string
        }
    }
}

enum EHistoryEntryType {
    CLAIM = 'CLAIM',
    REQUEST = 'REQUEST',
    CASHOUT = 'CASHOUT',
}

enum EHistoryUserRole {
    SENDER = 'SENDER',
    RECIPIENT = 'RECIPIENT',
    BOTH = 'BOTH',
}

export type HistoryEntryType = `${EHistoryEntryType}`
export type HistoryUserRole = `${EHistoryUserRole}`

export type Account = {
    identifier: string
    type: string
    isUser: boolean
    username?: string
}

export type TRequestHistory = {
    uuid: string
    type: HistoryEntryType
    timestamp: Date
    amount: string
    txHash: string
    chainId: string
    tokenSymbol: string
    tokenAddress: string
    status: string
    userRole: HistoryUserRole
    senderAccount?: Account
    recipientAccount: Account
}
