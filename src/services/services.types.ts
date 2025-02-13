// common types
export interface TimelineEntry {
    status: 'NEW' | 'PENDING' | 'COMPLETED' | 'EXPIRED' | 'FAILED' | 'SIGNED'
    time: string
}

interface FulfillmentPayment {
    payerTransactionHash: string
    payerChainId: string
    paidTokenAddress: string
    payerAddress: string
    fulfillmentTransactionHash: string
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

export interface PaymentRequest {
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
}

interface ChargeEntry {
    createdAt: string
    fulfillmentPayment: FulfillmentPayment
    timeline: TimelineEntry[]
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
}

export interface ChargeResponse {
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
    status: 'NEW' | 'PENDING' | 'COMPLETED' | 'FAILED' | 'SIGNED'
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

export interface RequestCharge {
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
