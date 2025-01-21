import { interfaces as peanutInterfaces } from '@squirrel-labs/peanut-sdk'

export type RecipientType = 'address' | 'ens' | 'iban' | 'us'

export interface IResponse {
    success: boolean
    data?: any
    message?: string
}

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

export type ITokenPriceData = {
    chainId: string
    price: number
} & IToken

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

interface IChain {
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
    type: 'Link Sent' | 'Direct Sent' | 'Link Received' | 'Offramp Claim' | 'Request Link' | 'Request Link Fulfillment'
    amount: string
    tokenSymbol: string
    date: string
    chain: string
    address: string | undefined
    // TODO: this is duplicaet with src/utils/CashoutStatus
    status:
        | 'claimed'
        | 'pending'
        | 'transfer'
        | 'paid'
        | 'REFUNDED'
        | 'READY'
        | 'AWAITING_TX'
        | 'AWAITING_FIAT'
        | 'FUNDS_IN_BRIDGE'
        | 'FUNDS_MOVED_AWAY'
        | 'FUNDS_IN_BANK'
        | 'AWAITING_FUNDS'
        | 'IN_REVIEW'
        | 'FUNDS_RECEIVED'
        | 'PAYMENT_SUBMITTED'
        | 'PAYMENT_PROCESSED'
        | 'CANCELED'
        | 'ERROR'
        | 'RETURNED'
        | undefined
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

export interface IExtendedLinkDetailsOfframp extends IExtendedLinkDetails {
    liquidationAddress: string
    recipientType: string
    accountNumber: string
    bridgeCustomerId: string
    bridgeExternalAccountId: string
    peanutCustomerId: string
    peanutExternalAccountId: string
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

interface KYCResponse {
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

interface IBridgeIbanDetails {
    type: 'iban'
    last_4: string
    bic: string
    country: string
}

interface IBridgeUsAccountDetails {
    type: 'us'
    last_4: string
    routing_number: string
}

interface IBridgeDepositInstructions {
    payment_rail: string
    amount: string
    currency: string
    from_address: string
    to_address: string
}

interface IBridgeSource {
    payment_rail: string
    currency: string
    from_address: string
}

interface IBridgeDestination {
    payment_rail: string
    currency: string
    external_account_id: string
}

interface IBridgeReceipt {
    initial_amount: string
    developer_fee: string
    exchange_fee: string
    subtotal_amount: string
    gas_fee: string
    final_amount: string
}

interface IBridgeTransaction {
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

export interface IProfileTableData {
    primaryText: string
    secondaryText: string
    tertiaryText: string
    quaternaryText: string
    itemKey: string
    type: 'history' | 'contacts' | 'accounts'
    address?: string
    avatar: {
        iconName?: string
        avatarUrl?: string
    }
    dashboardItem?: IDashboardItem
}

interface Transaction {
    tx_hash: string
    chain_id: string
    address: string
    points: number
    description: string | null
    created_at: string
}

interface ReferralConnection {
    user_id: string
    referrer: string
    account_identifier: string
}

interface PointsPerReferral {
    address: string
    points: number
    totalReferrals: number
}

interface User {
    userId: string
    email: string
    profile_picture: string | null
    username: string | null
    kycStatus: string
    bridge_customer_id: string | null
    full_name: string
    telegram: string | null
    hasPwAccess: boolean
}

// based on the API's AccountType
// https://github.com/peanutprotocol/peanut-api-ts/blob/b32570b7bd366efed7879f607040c511fa036a57/src/db/interfaces/account.ts
export enum AccountType {
    IBAN = 'iban',
    US = 'us',
    EVM_ADDRESS = 'evm-address',
    PEANUT_WALLET = 'peanut-wallet',
    BRIDGE = 'bridgeBankAccount',
}

// these types should always be the same as ChainId defined in
// src/constants/general.consts.ts -> supportedWalletconnectChains
// previously defined here:
// https://github.com/peanutprotocol/peanut-ui/blob/195c4a71111389b50034842e3a150fc82d827ef3/src/constants/general.consts.ts#L18
export type ChainIdType =
    | '1'
    | '10'
    | '56'
    | '100'
    | '137'
    | '324'
    | '1101'
    | '5000'
    | '8217'
    | '8453'
    | '42161'
    | '42220'
    | '43114'
    | '7777777'
    | '1313161554'

export interface Account {
    account_id: string
    user_id: string
    bridge_account_id: string
    account_type: AccountType
    account_identifier: string
    account_details: string
    created_at: string
    updated_at: string
    points: number
    referrer: string | null
    referred_users_points: number
    totalReferralPoints: number
    chain_id: ChainIdType
    connector?: {
        iconUrl: string
        name: string
    }
}

export interface IUserProfile {
    points: number
    transactions: Transaction[]
    referralsPointsTxs: Transaction[]
    totalReferralConnections: number
    referredUsers: number
    streak: number
    pwQueue: { totalUsers: number; userPosition: number | null }
    accounts: Account[]
    contacts: Contact[]
    totalPoints: number
    user: User
    pointsPerReferral: Array<{
        address: string
        points: number
        totalReferrals: number
    }>
    totalReferralPoints: number
}

interface Contact {
    user_id: string
    contact_id: string
    peanut_account_id: string | null
    account_identifier: string
    account_type: string
    nickname: string | null
    ens_name: string | null
    created_at: string
    updated_at: string
    n_interactions: number
    usd_volume_transacted: string
    last_interacted_with: string | null
    username: string | null
    profile_picture: string | null
}

export type JSONValue = string | number | boolean | null | JSONValue[] | { [key: string]: JSONValue }

export type JSONObject = {
    [key: string]: JSONValue
}
