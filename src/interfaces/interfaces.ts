import { interfaces as peanutInterfaces } from '@squirrel-labs/peanut-sdk'

export type RecipientType = 'address' | 'ens' | 'iban' | 'us' | 'username'

// Moved here from bridge-accounts.utils.ts to avoid circular dependency
export type BridgeKycStatus = 'not_started' | 'under_review' | 'approved' | 'rejected' | 'incomplete'

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

export enum MantecaKycStatus {
    ONBOARDING = 'ONBOARDING',
    ACTIVE = 'ACTIVE',
    INACTIVE = 'INACTIVE',
}

export interface IUserKycVerification {
    provider: 'MANTECA' | 'BRIDGE'
    mantecaGeo?: string | null
    bridgeGeo?: string | null
    status: MantecaKycStatus
    approvedAt?: string | null
    providerUserId?: string | null
    providerRawStatus?: string | null
    createdAt: string
    updatedAt: string
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
    kycVerifications?: IUserKycVerification[] // currently only used for Manteca, can be extended to other providers in the future, bridge is not migrated as it might affect existing users
    bridgeKycRejectionReasonString?: string | null
    tosStatus?: string
    tosAcceptedAt?: string
    bridgeCustomerId: string | null
    fullName: string
    telegram: string | null
    hasAppAccess: boolean
    showFullName: boolean
    showKycCompletedModal?: boolean
    createdAt: string
    accounts: Account[]
    badges?: Array<{
        id?: string
        code: string
        name: string
        description: string | null
        iconUrl: string | null
        color: string | null
        earnedAt: string | Date
        isVisible?: boolean
    }>
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
    MANTECA = 'manteca',
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
    // OLD Points V1 fields removed - use pointsV2 from stats instead
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

interface userInvites {
    inviteeId: string
    inviteeUsername: string
}

export interface IUserProfile {
    // OLD Points V1 fields removed - use pointsV2 in stats instead
    // Points V2: Use stats.pointsV2.totalPoints, pointsV2.inviteCount, etc.
    streak: number
    pwQueue: { totalUsers: number; userPosition: number | null }
    accounts: Account[]
    contacts: Contact[]
    totalPoints: number // Kept for backward compatibility - same as pointsV2.totalPoints
    hasPwaInstalled: boolean
    user: User
    invitesSent: userInvites[]
    showEarlyUserModal: boolean
    invitedBy: string | null // Username of the person who invited this user
}

export type JSONValue = string | number | boolean | null | JSONValue[] | { [key: string]: JSONValue }

export type JSONObject = {
    [key: string]: JSONValue
}

export interface Contact {
    userId: string
    username: string
    fullName: string | null
    bridgeKycStatus: string | null
    showFullName: boolean
    relationshipTypes: ('inviter' | 'invitee' | 'sent_money' | 'received_money')[]
    firstInteractionDate: string
    lastInteractionDate: string
    transactionCount: number
}

export interface ContactsResponse {
    contacts: Contact[]
    total: number
    hasMore: boolean
}

// limits types for fiat transactions
export interface BridgeLimits {
    onRampPerTransaction: string
    offRampPerTransaction: string
    asset: string
}

export interface MantecaLimit {
    exchangeCountry: string // 'ARG', 'BRA', etc.
    type: 'EXCHANGE' | 'REMITTANCE'
    asset: string // 'ARS', 'BRL', etc.
    yearlyLimit: string
    availableYearlyLimit: string
    monthlyLimit: string
    availableMonthlyLimit: string
}

export interface UserLimitsResponse {
    manteca: MantecaLimit[] | null
    bridge: BridgeLimits | null
}
