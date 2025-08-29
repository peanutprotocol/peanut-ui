import { BridgeKycStatus } from '@/utils'
import { interfaces as peanutInterfaces } from '@squirrel-labs/peanut-sdk'

export type RecipientType = 'address' | 'ens' | 'iban' | 'us' | 'username'

export interface IResponse {
    success: boolean
    data?: any
    message?: string
    details?: {
        code?: string
        message?: string
        requirements?: {
            [key: string]: string
        }
    }
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

export interface IBridgeAccount {
    id: string
    customer_id: string
    last_4: string
    currency?: 'usd' | 'eur' | 'mxn'
    bank_name?: string
    account_owner_name: string
    account_number?: string
    routing_number?: string
    account_type: 'iban' | 'us' | 'clabe'
    iban?: {
        account_number: string
        bic?: string
        country: string
    }
    clabe?: {
        account_number: string
    }
    account?: {
        account_number: string
        routing_number: string
        checking_or_savings?: string
    }
    account_owner_type: 'individual' | 'business'
    first_name?: string
    last_name?: string
    business_name?: string
    address?: {
        street_line_1: string
        street_line_2?: string
        city: string
        country: string
        state?: string
        postal_code?: string
    }
    beneficiary_address_valid: boolean
}

interface Transaction {
    tx_hash: string
    chain_id: string
    address: string
    points: number
    description: string | null
    created_at: string
}

export type LinkStatus = 'loading' | 'unclaimed' | 'claimed' | 'expired' | 'cancelled'

export interface PaymentLink {
    type: 'send' | 'request'
    amount: number
    username: string // creator or requester
    status: LinkStatus
}

interface ReferralConnection {
    user_id: string
    referrer: string
    account_identifier: string
}

export interface User {
    userId: string
    email: string
    profile_picture: string | null
    username: string | null
    bridgeKycStatus: BridgeKycStatus
    bridgeKycStartedAt?: string
    bridgeKycApprovedAt?: string
    bridgeKycRejectedAt?: string
    tosStatus?: string
    tosAcceptedAt?: string
    bridgeCustomerId: string | null
    fullName: string
    telegram: string | null
    hasPwAccess: boolean
    accounts: Account[]
}

// based on the API's AccountType
// https://github.com/peanutprotocol/peanut-api-ts/blob/b32570b7bd366efed7879f607040c511fa036a57/src/db/interfaces/account.ts
export enum AccountType {
    IBAN = 'iban',
    US = 'us',
    CLABE = 'clabe',
    EVM_ADDRESS = 'evm-address',
    PEANUT_WALLET = 'peanut-wallet',
    BRIDGE = 'bridgeBankAccount',
}

export interface Account {
    id: string
    userId: string
    bridgeAccountId: string
    type: AccountType
    identifier: string
    details: {
        bankName: string | null
        accountOwnerName: string
        countryCode: string
        countryName: string
    }
    createdAt: string
    updatedAt: string
    points: number
    referrerAddress: string | null
    referredUsersPoints: number
    chainId: string | null
    connectorUuid: string | null
    bic?: string
    routingNumber?: string
    connector?: {
        iconUrl: string
        name: string
    }
    transactions: Transaction[]
    referrals: ReferralConnection[]
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
    hasPwaInstalled: boolean
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
