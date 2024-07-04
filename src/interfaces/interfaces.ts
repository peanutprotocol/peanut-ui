import { interfaces as peanutInterfaces } from '@squirrel-labs/peanut-sdk'

export type RecipientType = 'address' | 'ens' | 'iban' | 'us'

export interface IUserBalance {
    chainId: string
    address: string
    name: string
    symbol: string
    decimals: number
    price: number
    amount: number
    currency: string
    logoURI: string
    value: string
}

export interface IPeanutChainDetails {
    name: string
    chain: string
    icon: {
        url: string

        format: string
    }
    rpc: string[]
    features: {
        name: string
    }[]
    faucets: string[]
    nativeCurrency: {
        name: string
        symbol: string
        decimals: number
    }
    infoURL: string
    shortName: string
    chainId: string
    networkId: number
    slip44: number
    ens: {
        registry: string
    }
    explorers: {
        name: string
        url: string
        standard: string
    }[]
    mainnet: boolean
}

export interface IPeanutTokenDetail {
    chainId: string
    name: string
    tokens: IToken[]
}

export interface IToken {
    address: string
    name: string
    symbol: string
    decimals: number
    logoURI: string
}

export interface ILocalStorageItem {
    address: string
    hash: string
    idx?: string
    link: string
}

export interface ILinkDetails {
    link: string
    chainId: string
    depositIndex: number
    contractVersion: string
    password: string
    senderAddress: any
    tokenType: any
    tokenAddress: any
    tokenDecimals: any
    tokenSymbol: any
    tokenName: any
    tokenAmount: string
    tokenId: number
    claimed: boolean
    depositDate: Date
    tokenURI: any
    metadata: any
    rawOnchainDepositInfo: {}
}

export interface IChain {
    chainId: string
    axelarChainName: string
    chainType: string
}

export interface IToken {
    chainId: string
    address: string
    name: string
    symbol: string
}

export interface IExtendedPeanutLinkDetails extends peanutInterfaces.IPeanutLinkDetails {
    link: string
    depositDate: string
    USDTokenPrice: number
    points: number
    txHash: string
    message: string | undefined
    attachmentUrl: string | undefined
}

export interface IDashboardItem {
    link: string | undefined
    type: 'Link Sent' | 'Direct Sent' | 'Link Received'
    amount: string
    tokenSymbol: string
    date: string
    chain: string
    address: string | undefined
    status: 'claimed' | 'pending' | 'transfer' | undefined
    message: string | undefined
    attachmentUrl: string | undefined
    points: number
    txHash: string | undefined
}

export interface IExtendedLinkDetails extends ILinkDetails {
    USDTokenPrice: number
    points: number
    txHash: string
    message: string | undefined
    attachmentUrl: string | undefined
}

export type ChainValue = {
    chainId: string
    valuePerChain: number
}

export interface IDirectSendDetails {
    chainId: string
    tokenAmount: string
    tokenAddress: string
    date: string
    points: number
    txHash: string
}

export interface KYCData {
    id: string
    full_name: string
    email: string
    type: string
    kyc_link: string
    tos_link: string
    kyc_status: string
    rejection_reasons: string[]
    tos_status: string
    created_at: string
    customer_id: string | null
    persona_inquiry_type: string
}

export interface KYCResponse {
    count: number
    data: KYCData[]
}

export interface IBridgeAccount {
    id: string
    customer_id: string
    created_at: string
    updated_at: string
    bank_name: string | null
    account_name: string | null
    account_owner_name: string
    active: boolean
    currency: string
    account_owner_type: string | null
    account_type: 'iban' | 'us'
    first_name: string | null
    last_name: string | null
    business_name: string | null
    beneficiary_address_valid?: boolean // Optional, only present in US account
    last_4: string

    // Use a union type for the account-specific details
    account_details: IBridgeIbanDetails | IBridgeUsAccountDetails
}

export interface IBridgeIbanDetails {
    type: 'iban'
    last_4: string
    bic: string
    country: string
}

export interface IBridgeUsAccountDetails {
    type: 'us'
    last_4: string
    routing_number: string
}

export interface IBridgeDepositInstructions {
    payment_rail: string
    amount: string
    currency: string
    from_address: string
    to_address: string
}

export interface IBridgeSource {
    payment_rail: string
    currency: string
    from_address: string
}

export interface IBridgeDestination {
    payment_rail: string
    currency: string
    external_account_id: string
}

export interface IBridgeReceipt {
    initial_amount: string
    developer_fee: string
    exchange_fee: string
    subtotal_amount: string
    gas_fee: string
    final_amount: string
}

export interface IBridgeTransaction {
    id: string
    client_reference_id: string | null
    state: string
    on_behalf_of: string
    source_deposit_instructions: IBridgeDepositInstructions
    currency: string
    amount: string
    developer_fee: string
    source: IBridgeSource
    destination: IBridgeDestination
    receipt: IBridgeReceipt
    created_at: string
    updated_at: string
}

export interface IBridgeLiquidationAddress {
    id: string
    chain: string
    external_account_id: string
    currency: string
    address: string
    destination_wire_message?: string // for wire
    destination_sepa_reference?: string // for sepa
    destination_payment_rail: string
    destination_currency: string
    created_at: string
    updated_at: string
}
