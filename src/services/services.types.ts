import { interfaces as peanutInterfaces } from '@squirrel-labs/peanut-sdk'

export type TStatus = 'NEW' | 'PENDING' | 'COMPLETED' | 'EXPIRED' | 'FAILED' | 'SIGNED' | 'SUCCESSFUL' | 'CANCELLED'

export interface TimelineEntry {
    status: TStatus
    time: string
}

// requests service types
export interface CreateRequestRequest {
    chainId: string
    tokenAmount?: string
    recipientAddress: string
    trackId?: string
    reference?: string
    tokenType: string
    tokenAddress: string
    tokenDecimals: string
    tokenSymbol: string
    attachment?: File
    mimeType?: string
    filename?: string
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
    trackId: string | null
    reference: string | null
    attachmentUrl: string | null
    createdAt: string
    updatedAt: string
    charges: ChargeEntry[]
    history: TRequestHistory[]
    recipientAccount: {
        userId: string
        identifier: string
        type: string
        user: {
            username: string
        }
    }
}

export interface ChargeEntry {
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
    fulfillmentPayment: Payment | null
    timeline: TimelineEntry[]
    requestLink: RequestLink
}

export interface RequestLink {
    recipientAddress: string
    reference: string | null
    attachmentUrl: string | null
    trackId: string | null
    recipientAccount: {
        userId: string
        identifier: string
        type: string
        user: {
            username: string
        }
    }
}

// charges service types
export interface LocalPrice {
    amount: string
    currency: string
}

export interface RequestProps {
    chainId: string
    tokenAmount?: string
    tokenAddress: string
    tokenType: peanutInterfaces.EPeanutLinkType
    tokenSymbol: string
    tokenDecimals: number
    recipientAddress: string
    requesteeUsername?: string
}

export type TChargeTransactionType = 'REQUEST' | 'DIRECT_SEND' | 'DEPOSIT' | 'WITHDRAW'

export interface CreateChargeRequest {
    pricing_type: 'fixed_price'
    local_price: LocalPrice
    baseUrl: string
    requestId?: string
    requestProps?: RequestProps
    attachment?: File
    reference?: string
    transactionType?: TChargeTransactionType
    mimeType?: string
    filename?: string
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
    payerAccount?: {
        userId: string | null
        identifier: string
        type: string
        user: {
            username: string
        } | null
    }
}

// Payment creation response
export interface PaymentCreationResponse {
    uuid: string
    paidTokenAddress: string
    payerChainId: string
    payerTransactionHash: string
    createdAt: string
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
    fulfillmentPayment: Payment | null
    currencyCode: string
    currencyAmount: string
    timeline: TimelineEntry[]
    requestee?: {
        userId: string
        username: string
    }
    requestLink: {
        recipientAddress: string
        reference: string | null
        attachmentUrl: string | null
        trackId: string | null
        recipientAccount: {
            userId: string
            identifier: string
            type: string
            user: {
                username: string
            }
        }
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

export type RewardLink = {
    link: string
    assetCode: string
    campaign: {
        id: string
        name: string
    }
}
