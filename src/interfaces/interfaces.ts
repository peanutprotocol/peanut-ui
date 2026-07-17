import { type SumsubKycStatus } from '@/app/actions/types/sumsub.types'
import { type UserCapabilities, type IdentityVerification } from '@/types/capabilities'

export type RecipientType = 'address' | 'ens' | 'iban' | 'us' | 'username'

// phases for the multi-phase kyc verification modal
export type KycModalPhase = 'verifying' | 'preparing' | 'bridge_tos' | 'complete'

// per-provider rail status for tracking after kyc approval
export type ProviderDisplayStatus = 'setting_up' | 'requires_tos' | 'requires_documents' | 'enabled' | 'failed'

export interface ProviderStatus {
    providerCode: string
    displayName: string
    status: ProviderDisplayStatus
    rails: IUserRail[]
}

// Moved here from bridge-accounts.utils.ts to avoid circular dependency
export type BridgeKycStatus = 'not_started' | 'under_review' | 'approved' | 'rejected' | 'incomplete'

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

export interface IToken {
    chainId: string
    address: string
    name: string
    symbol: string
}

export interface IBridgeAccount {
    id: string
    customer_id: string
    last_4: string
    currency?: 'usd' | 'eur' | 'mxn' | 'gbp'
    bank_name?: string
    account_owner_name: string
    account_number?: string
    routing_number?: string
    account_type: 'iban' | 'us' | 'clabe' | 'gb'
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
        routing_number?: string
        sort_code?: string // uk bank accounts
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

export type LinkStatus = 'loading' | 'unclaimed' | 'claimed' | 'expired' | 'cancelled'

export interface PaymentLink {
    type: 'send' | 'request'
    amount: number
    username: string // creator or requester
    status: LinkStatus
}

export enum MantecaKycStatus {
    ONBOARDING = 'ONBOARDING',
    ACTIVE = 'ACTIVE',
    INACTIVE = 'INACTIVE',
}

export interface IUserKycVerification {
    provider: 'MANTECA' | 'BRIDGE' | 'SUMSUB'
    mantecaGeo?: string | null
    bridgeGeo?: string | null
    status: MantecaKycStatus | SumsubKycStatus | string
    approvedAt?: string | null
    providerUserId?: string | null
    providerRawStatus?: string | null
    sumsubApplicantId?: string | null
    rejectLabels?: string[] | null
    rejectType?: 'RETRY' | 'FINAL' | 'PROVIDER_FIXABLE' | 'PROVIDER_FINAL' | null
    metadata?: { regionIntent?: string; [key: string]: unknown } | null
    createdAt: string
    updatedAt: string
}

export interface User {
    userId: string
    email: string
    profile_picture: string | null
    username: string | null
    tosStatus?: string
    tosAcceptedAt?: string
    bridgeCustomerId: string | null
    fullName: string
    telegram: string | null
    /** Self-reported offramp.xyz username/email — collected once on the
     *  migration deposit screen (offramp payout reconciliation). */
    offrampHandle?: string | null
    hasAppAccess: boolean
    isActivated?: boolean
    activatedAt?: string | null
    activationMilestone?: 'registered' | 'verified' | 'funded' | 'activated'
    showFullName: boolean
    // Null until the user dismisses the "You're unlocked" celebration. The modal
    // shows once, when KYC-approved (a rail is enabled) AND this is still null.
    activationCelebratedAt?: string | null
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

/**
 * A user fetched by id (getUserById) — i.e. a COUNTERPARTY (the link sender, the
 * request requester), not the current user. Provider-blind, like the current-user
 * read-models: the only cross-user signal the FE actually needs is whether a
 * guest claim-to-bank can off-ramp through this counterparty (BankFlowManager
 * uses their bridgeCustomerId), which the BE exposes as a derived boolean.
 *
 * (The wider "is this person verified" badge — used by send/request/contacts —
 * is a separate concern, still reading `Contact.bridgeKycStatus` / shapes from
 * other endpoints. Cleaning those up is a follow-up.)
 */
export type CounterpartyUser = User & {
    /** Has an enabled Bridge bank rail; a guest can off-ramp through them. */
    canReceiveBankOfframp: boolean
    /** Provider-agnostic identity-verified signal (BE-computed). The "verified" badge. */
    isVerified: boolean
}

// based on the API's AccountType
// https://github.com/peanutprotocol/peanut-api-ts/blob/b32570b7bd366efed7879f607040c511fa036a57/src/db/interfaces/account.ts
export enum AccountType {
    IBAN = 'iban',
    US = 'us',
    CLABE = 'clabe',
    GB = 'gb', // uk bank accounts (sort code + account number)
    EVM_ADDRESS = 'evm-address',
    PEANUT_WALLET = 'peanut-wallet',
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
    chainId: string | null
    bic?: string
    routingNumber?: string
    sortCode?: string // uk bank accounts
}

interface userInvites {
    inviteeId: string
    inviteeUsername: string
}

export type UserRailStatus =
    | 'PENDING'
    | 'ENABLED'
    | 'REQUIRES_INFORMATION'
    | 'REQUIRES_EXTRA_INFORMATION'
    | 'REJECTED'
    | 'FAILED'

export interface IUserRail {
    id: string
    railId: string
    status: UserRailStatus
    metadata?: { bridgeCustomerId?: string; additionalRequirements?: string[]; [key: string]: unknown } | null
    rail: {
        id: string
        provider: { code: string; name: string }
        method: { code: string; name: string; country: string; currency: string }
    }
}

export interface IUserProfile {
    // OLD Points V1 fields removed - use pointsV2 in stats instead
    // Points V2: Use stats.pointsV2.totalPoints, pointsV2.inviteCount, etc.
    streak: number
    pwQueue: { totalUsers: number; userPosition: number | null }
    accounts: Account[]
    contacts: Contact[]
    totalPoints: number // Kept for backward compatibility - same as pointsV2.totalPoints
    user: User
    rails: IUserRail[]
    invitesSent: userInvites[]
    showEarlyUserModal: boolean
    invitedBy: string | null // Username of the person who invited this user
    // Backend-computed capability model — TOP-LEVEL sibling of `user` on the
    // /get-user response (NOT user.capabilities). Read via useCapabilities().
    // Optional during the add→migrate→delete sequence (D11): present once the
    // API PR ships, raw KYC fields above removed last. See kyc-2.0 plan.
    capabilities?: UserCapabilities
    // Provider-agnostic identity-verification status — TOP-LEVEL sibling of
    // `capabilities` on /get-user. Read via useIdentityVerification(). The status
    // surfaces render this; no provider names. Optional during the migration.
    identityVerification?: IdentityVerification
}

export type JSONValue = string | number | boolean | null | JSONValue[] | { [key: string]: JSONValue }

export type JSONObject = {
    [key: string]: JSONValue
}

export interface Contact {
    userId: string
    username: string
    fullName: string | null
    /** Provider-agnostic verified badge (BE-computed `computeIsVerified`). */
    isVerified: boolean
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
