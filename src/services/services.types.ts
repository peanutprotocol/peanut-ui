import { type BridgeKycStatus } from '@/utils/bridge-accounts.utils'
import * as peanutInterfaces from '@/interfaces/peanut-sdk-types'
import type { paths } from '@/types/api.generated'

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
    /** the requester lets a payer settle this request by bank transfer */
    bankInstructionsShared?: boolean
    /**
     * The amount asked, in a fiat currency. Sent for a non-USD request alone:
     * the API then sets `tokenAmount` (always dollars) at its own rate and
     * ignores the one in this body. A USD request omits it, so it is the same
     * body an API without the field accepts.
     */
    requestedAmount?: { amount: string; currency: string }
}

/**
 * The requester's standing bank details for one request, plus the reference a
 * payer must type. Derived from the generated contract rather than restated,
 * so a field the API drops fails the build at every reader.
 */
export type RequestDepositInstructions = Omit<
    paths['/requests/{uuid}/deposit-instructions']['get']['responses'][200]['content']['application/json'],
    'payerAmount'
> & {
    /**
     * The amount to send in this account's currency. Optional here although
     * the contract makes it required: an API that predates the field is still
     * answering during the deploy window, so every reader must handle it
     * missing.
     */
    payerAmount?: RequestPayerAmount
}

/**
 * `GET /requests/:uuid/pay-amounts` — what is left to pay, on every rail the
 * requester can receive on. Derived from the generated contract, so a field the
 * API drops fails the build at every reader.
 */
export type RequestPayAmounts =
    paths['/requests/{uuid}/pay-amounts']['get']['responses'][200]['content']['application/json']

/** One way to pay a request, with the amount in that rail's own currency. */
export type RequestPayRail = RequestPayAmounts['rails'][number]

/** The amount a payer settles on one rail, in that rail's currency. */
export type RequestPayerAmount = RequestPayRail['payerAmount']

/**
 * How much of a request money arriving by bank answered, as the backend
 * decides it: nothing yet, some of it, or the whole request.
 */
export type BankFulfilment = 'none' | 'partial' | 'paid'

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
    /**
     * A bank deposit carrying this request's reference answered it. `paidAt`
     * is when it landed and `receivedAmount` is what arrived, which can be
     * less than `tokenAmount` — a part payment leaves the request open.
     *
     * `bankFulfilment` is the backend's own verdict on those two numbers: a
     * transfer loses fees on the way, so the request counts as paid once the
     * net amount is close enough to the amount asked. Read it rather than
     * comparing the amounts here.
     *
     * `payerName` is the name the payer's bank reported on the last transfer.
     * It is on the owner-facing request alone — a payer opening the link never
     * sees who else paid it.
     *
     * Both are optional while the backend that returns them ships.
     */
    paidAt: string | null
    receivedAmount: string | null
    bankFulfilment?: BankFulfilment
    payerName?: string | null
    bankInstructionsShared: boolean
    /** the fiat currency the requester asked in; absent or null means USD. `tokenAmount` is always dollars. */
    currency?: string | null
    /** the amount asked, in `currency`; null unless the requester asked in a fiat currency */
    requestedAmount?: string | null
    /** dollars per one unit of `currency` when the request was created */
    requestedFxRate?: string | null
    requestedFxAsOf?: string | null
    charges: ChargeEntry[]
    history: TRequestHistory[]
    recipientAccount: {
        userId: string
        identifier: string
        type: string
        user: {
            username: string
            avatarKey?: string | null
        }
    }
    totalCollectedAmount: number
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
    uuid: string
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
            avatarKey?: string | null
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
    /**
     * ENS name the payer typed, when they typed one. Recorded on the charge and
     * read at settlement to award the ENS badge. The API takes it on trust —
     * `validateEnsName` at the call sites is the only filter — which is safe
     * only while the badge grants nothing (see peanut-api-ts
     * `acknowledgments/ens-payment-badges.ts` before attaching anything to it).
     */
    recipientEnsName?: string
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
            bridgeKycStatus?: string
            avatarKey?: string | null
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
    transactionType: TChargeTransactionType
    /**
     * The ledger kind behind the charge, which a receipt is looked up by.
     * `transactionType` folds several kinds into one, so it cannot stand in for
     * this. Absent on an API deployed before it (api#1638).
     */
    intentKind?: string
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
        uuid: string
        recipientAddress: string
        reference: string | null
        attachmentUrl: string | null
        trackId: string | null
        recipientAccount: {
            userId: string
            identifier: string
            type: string
            username?: string
            bridgeKycStatus?: string
            user: {
                username: string
                bridgeKycStatus?: string
                avatarKey?: string | null
            }
        }
    }
}

// Event types for the per-request history log (request-creation, claim,
// cashout). Distinct from the unified `/users/history` wire shape — keep
// this namespace separate so the two histories don't collide.
enum ERequestHistoryEventType {
    CLAIM = 'CLAIM',
    REQUEST = 'REQUEST',
    CASHOUT = 'CASHOUT',
}

enum EHistoryUserRole {
    SENDER = 'SENDER',
    RECIPIENT = 'RECIPIENT',
    BOTH = 'BOTH',
}

export type RequestHistoryEventType = `${ERequestHistoryEventType}`
export type HistoryUserRole = `${EHistoryUserRole}`

export type Account = {
    identifier: string
    type: string
    isUser: boolean
    username?: string
}

export type TRequestHistory = {
    uuid: string
    type: RequestHistoryEventType
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

// offramp service types
export interface TCreateOfframpRequest {
    developer_fee?: string
    onBehalfOf?: string
    userId?: string
    amount?: string
    source: {
        currency: string
        paymentRail: string
        fromAddress?: string
    }
    destination: {
        currency: string
        paymentRail: string
        externalAccountId: string
        wireMessage?: string
        sepaReference?: string
        achReference?: string
    }
    sendLinkPubKey?: string
    features?: {
        allowAnyFromAddress?: boolean
    }
    // travel rule: claimer (beneficiary) details for third-party guest claims
    beneficiaryName?: string
    beneficiaryAddress?: {
        street: string
        city: string
        country: string
        state?: string
        postalCode?: string
    }
    /**
     * From a `fixed_output` offramp quote. The server then takes both amounts
     * from the quote; `amount` must equal its `sourceAmount`.
     */
    quoteId?: string
}

/**
 * How an offramp quote is priced. `fixed_output`: Peanut's FX margin is
 * inside `rate`, and a quote with an amount carries the `quoteId` create must
 * be given. `bridge_rate`: Bridge's rate, and the transfer converts at
 * settlement (the legacy path, also while collection is off).
 */
export type OfframpPricing = 'bridge_rate' | 'fixed_output'

/** The side of an offramp the user typed: the bank amount, or the USDC that leaves the balance. */
export type OfframpQuoteAmount = { destinationAmount: string } | { sourceAmount: string }

/**
 * GET /bridge/offramp/quote: the USDC a typed bank amount costs at the current
 * rate (`rate` = bank units per 1 USDC, fee included), or the bank amount a
 * typed USDC amount buys. Derived from the generated contract, so a field the
 * API drops fails the build at every reader.
 * TODO: the pricing fields are added by hand until the OpenAPI snapshot is
 * refreshed from the fees-v2 API branch; drop the intersection then.
 */
export type OfframpQuote = paths['/bridge/offramp/quote']['get']['responses'][200]['content']['application/json'] & {
    pricing: OfframpPricing
    /** Signed, for `fixed_output` quotes with an amount. Pass it to create unchanged. */
    quoteId?: string
    expiresAt?: string
}

/** Body of POST /bridge/offramp/create-for-guest. The sender comes from the link, never from here. */
export interface TCreateGuestOfframpRequest {
    /** Must equal the link amount, as a decimal of its token. */
    amount: string
    sendLinkPubKey: string
    /** Link key signature over guestBankClaimMessage(sendLinkPubKey, destination.externalAccountId). */
    signature: string
    source: TCreateOfframpRequest['source']
    destination: TCreateOfframpRequest['destination']
    /** travel rule: the guest claimer is the beneficiary */
    beneficiaryName: string
    beneficiaryAddress?: TCreateOfframpRequest['beneficiaryAddress']
}

export interface TCreateOfframpResponse {
    transferId: string
    depositInstructions: {
        toAddress: string
        blockchainMemo?: string
    }
    quote: {
        amount_in: string
        amount_out: string
        exchange_rate: string
        total_fee: string
        destination_currency: string
        developer_fee: string
        exchange_fee: string
        subtotal_amount: string
        remaining_prefunded_amount?: string
        gas_fee?: string
        final_amount?: string
        source_tx_hash?: string
        destination_tx_hash?: string
        url?: string
    }
    depositAddress: string
    deposit_chain_id: number
    deposit_token_address: string
}

export enum ESendLinkStatus {
    creating = 'creating',
    completed = 'completed',
    CLAIMING = 'CLAIMING',
    CLAIMED = 'CLAIMED',
    CANCELLED = 'CANCELLED',
    FAILED = 'FAILED',
}

export type SendLinkStatus = `${ESendLinkStatus}`

export type SendLink = {
    pubKey: string
    depositIdx: number
    chainId: string
    contractVersion: string
    textContent?: string
    fileUrl?: string
    status: SendLinkStatus
    /** Machine-readable reason the last claim attempt failed. The optimistic
     *  claim path is answered 202 before the broadcast, so this is the only
     *  thing a poller can read to tell a retryable outage from a dead end. */
    claimFailureCode?: string | null
    /** Stamped on cancel/reclaim — the receipt's cancellation date. */
    cancelledAt?: Date | string | null
    createdAt: Date
    senderAddress: string
    amount: bigint
    tokenAddress: string
    tokenDecimals: number
    tokenSymbol: string
    sender: {
        userId: string
        username: string
        fullName: string
        bridgeKycStatus: string
        avatarKey?: string | null
        accounts: {
            identifier: string
            type: string
        }[]
    } | null
    claim?: {
        amount: string
        txHash: string
        tokenAddress: string
        recipientAddress?: string
        recipient?: {
            userId: string
            username: string
            fullName: string
            bridgeKycStatus: string
            accounts: {
                identifier: string
                type: string
            }[]
        }
    }
    /** Absent post-ledger-collapse: the API no longer selects the `events` relation. */
    events?: {
        timestamp: Date
        status: SendLinkStatus
        reason?: string
    }[]
}

export enum EInviteType {
    DIRECT = 'DIRECT',
    PAYMENT_LINK = 'PAYMENT_LINK',
}

export interface Invite {
    id: string
    type: EInviteType
    createdAt: string
    invitee: {
        bridgeKycStatus: BridgeKycStatus
        username: string
        fullName: string | null
    }
}

export interface TierInfo {
    userId: string
    directPoints: number
    transitivePoints: number
    totalPoints: number
    currentTier: number
    nextTierThreshold: number
    pointsToNextTier: number
}

export interface PointsInvite {
    inviteeId: string
    username: string
    fullName: string | null
    showFullName?: boolean
    /** Invitee's picked profile avatar; null means the username-letter fallback. */
    avatarKey?: string | null
    invitedAt: string
    kycStatus: BridgeKycStatus | null
    kycVerified: boolean
    directPoints: number
    totalPoints: number
    contributedPoints: number
    hasInvitedOthers: boolean
    inviteesCount: number
    /** usd earned from this invitee's transactions (rewards v2) */
    lifetimeEarnedUsd?: number
}

export interface PointsInvitesResponse {
    invitees: PointsInvite[]
    summary: {
        multiplier: number
        pendingInvites: number
        totalContributedPoints: number
        totalDirectPoints: number
        totalInvites: number
        verifiedInvites: number
        /** total usd earned from all invitees (rewards v2) */
        totalLifetimeEarnedUsd?: number
        /** total pending usd across all invitees (rewards v2) */
        totalPendingUsd?: number
    }
}

export enum PointsAction {
    BRIDGE_TRANSFER = 'BRIDGE_TRANSFER',
    MANTECA_TRANSFER = 'MANTECA_TRANSFER',
    MANTECA_QR_PAYMENT = 'MANTECA_QR_PAYMENT',
    P2P_SEND_LINK = 'P2P_SEND_LINK',
    P2P_REQUEST_PAYMENT = 'P2P_REQUEST_PAYMENT',
}

export interface CalculatePointsRequest {
    actionType: PointsAction
    usdAmount: number
    otherUserId?: string
}

// Perks system - Unified interface (all perks are V2 campaigns now)
export interface HistoryEntryPerkReward {
    reason: string
    discountPercentage: number
    originatingTxId?: string
    originatingTxType?: string
    perkName?: string
}

export type RhinoChainType = 'EVM' | 'SOL' | 'TRON'
export interface CreateDepositAddressResponse {
    depositAddress: string
    minDepositLimitUsd: number
    maxDepositLimitUsd: number
    supportedChains: string[]
}

export interface DepositAddressStatusResponse {
    status: string
    amount?: number
    txHash?: string
    chainIn?: string
    tokenSymbol?: string
    tokenAmount?: string
}

export type RewardLink = {
    link: string
    assetCode: string
    campaign: {
        id: string
        name: string
    }
}
