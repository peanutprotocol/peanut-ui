// payment flow types
// core types for the new payment flow architecture
// used across all payment flows (send, fulfill-request, contribute-pot, pay-address)

import { type TransactionReceipt, type Address, type Hash } from 'viem'

// flow state types

// common step states used across all payment flows
export type PaymentStep = 'input' | 'confirm' | 'executing' | 'success' | 'error'

// recipient type from url parsing
export type RecipientType = 'ENS' | 'ADDRESS' | 'USERNAME'

// resolved recipient details
export interface RecipientDetails {
    type: RecipientType
    identifier: string
    resolvedAddress: Address
}

// charge types

// status of a charge or payment
export type ChargeStatus =
    | 'NEW'
    | 'PENDING'
    | 'COMPLETED'
    | 'EXPIRED'
    | 'FAILED'
    | 'SIGNED'
    | 'SUCCESSFUL'
    | 'CANCELLED'

// transaction type for charge creation
export type ChargeTransactionType = 'REQUEST' | 'DIRECT_SEND' | 'DEPOSIT' | 'WITHDRAW'

// minimal charge details needed for payment flows
export interface ChargeDetails {
    uuid: string
    chainId: string
    tokenAmount: string
    tokenAddress: Address
    tokenDecimals: number
    tokenSymbol: string
    tokenType: string
    recipientAddress: Address
    reference?: string
    attachmentUrl?: string
    currencyCode?: string
    currencyAmount?: string
}

// parameters for creating a new charge
export interface CreateChargeParams {
    tokenAmount: string
    tokenAddress: Address
    chainId: string
    tokenSymbol: string
    tokenDecimals: number
    recipientAddress: Address
    transactionType: ChargeTransactionType
    reference?: string
    attachment?: File
    currencyAmount?: string
    currencyCode?: string
}

// transaction types

// unsigned transaction ready for execution
export interface UnsignedTransaction {
    to: Address
    data?: `0x${string}`
    value?: bigint
}

// result of a transaction execution
export interface TransactionResult {
    txHash: Hash
    receipt: TransactionReceipt | null
    userOpHash?: Hash
}

// cross-chain route information
export interface CrossChainRoute {
    type: 'rfq' | 'swap'
    fromAmount: string
    toAmountMin: string
    feeCostsUsd: number
    expiry?: number
    transactions: UnsignedTransaction[]
    rawResponse: any // squid response
}

// payment recording types

// parameters for recording a payment to the backend
export interface RecordPaymentParams {
    chargeId: string
    chainId: string
    txHash: string
    tokenAddress: Address
    payerAddress: Address
}

// response from payment recording
export interface PaymentRecord {
    uuid: string
    payerTransactionHash: string
    payerChainId: string
    paidTokenAddress: string
    createdAt: string
}

// flow-specific state types

// send flow state - for direct payments to peanut users
export interface SendFlowState {
    step: PaymentStep
    amount: string
    usdAmount: string
    recipient: RecipientDetails | null
    charge: ChargeDetails | null
    txHash: Hash | null
    error: string | null
    attachmentOptions: AttachmentOptions
}

// fulfill request flow state - for paying someone's request link
export interface FulfillRequestFlowState {
    step: PaymentStep
    charge: ChargeDetails | null
    route: CrossChainRoute | null
    txHash: Hash | null
    error: string | null
}

// contribute pot flow state - for request pot contributions
export interface ContributePotFlowState {
    step: PaymentStep
    amount: string
    usdAmount: string
    requestId: string
    totalAmount: string
    collectedAmount: string
    contributors: PotContributor[]
    charge: ChargeDetails | null
    txHash: Hash | null
    error: string | null
}

// pay address flow state - for payments to external addresses/ens
export interface PayAddressFlowState {
    step: PaymentStep
    amount: string
    usdAmount: string
    recipient: RecipientDetails | null
    selectedToken: TokenInfo | null
    selectedChainId: string | null
    route: CrossChainRoute | null
    charge: ChargeDetails | null
    txHash: Hash | null
    error: string | null
}

// supporting types

// attachment options for payments with messages/files
export interface AttachmentOptions {
    fileUrl?: string
    message?: string
    rawFile?: File
}

// token information for token selector
export interface TokenInfo {
    address: Address
    symbol: string
    decimals: number
    chainId: string
    logoURI?: string
    price?: number
}

// contributor to a request pot
export interface PotContributor {
    uuid: string
    amount: string
    username?: string
    address: Address
    createdAt: string
}

// action types (for reducers)

// base action type with discriminated union pattern
export type PaymentAction<T extends string, P = undefined> = P extends undefined ? { type: T } : { type: T; payload: P }

// common actions shared across flows
export type CommonPaymentAction =
    | PaymentAction<'SET_AMOUNT', string>
    | PaymentAction<'SET_USD_AMOUNT', string>
    | PaymentAction<'SET_CHARGE', ChargeDetails>
    | PaymentAction<'SET_TX_HASH', Hash>
    | PaymentAction<'SET_ERROR', string>
    | PaymentAction<'CLEAR_ERROR'>
    | PaymentAction<'EXECUTE_START'>
    | PaymentAction<'EXECUTE_SUCCESS', Hash>
    | PaymentAction<'EXECUTE_ERROR', string>
    | PaymentAction<'RESET'>
