// common types
interface TimelineEntry {
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
    payments: unknown[]
    fulfillmentPayment: FulfillmentPayment
    timeline: TimelineEntry[]
    requestLink: {
        recipientAddress: string
        reference?: string
        attachmentUrl?: string
        trackId?: string
    }
}
