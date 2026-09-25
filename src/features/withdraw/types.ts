import { type ITokenPriceData, type Account } from '@/interfaces/interfaces'
import type { ChainWithTokens } from '@/interfaces/chain-meta'

export interface WithdrawMethod {
    type: 'bridge' | 'manteca' | 'crypto'
    countryPath?: string
    currency?: string
    minimumAmount?: number
    savedAccount?: Account
    title?: string
}

export interface WithdrawData {
    token: ITokenPriceData
    chain: ChainWithTokens
    address: string
    amount: string
}

/** Named screen ids for the root /withdraw page — these appear verbatim in the URL. */
export const WITHDRAW_ROOT_STEPS = ['method', 'amount'] as const
export type WithdrawRootStep = (typeof WITHDRAW_ROOT_STEPS)[number]

/** Named screen ids for /withdraw/crypto. */
export const WITHDRAW_CRYPTO_STEPS = ['recipient', 'amount', 'review', 'success'] as const
export type WithdrawCryptoStep = (typeof WITHDRAW_CRYPTO_STEPS)[number]

/** Named screen ids for /withdraw/[country]/bank. */
export const WITHDRAW_BANK_STEPS = ['review', 'success'] as const
export type WithdrawBankStep = (typeof WITHDRAW_BANK_STEPS)[number]

/**
 * What a Bridge bank withdrawal pays out, for the review and success screens
 * (TASK-23054). `currency` is what the transfer sends (lowercase ISO, from the
 * account type). `amount` is the bank amount: typed by the user when
 * `enteredInBankCurrency`, else the USD amount at the quote `rate`. Both are
 * absent for a USD payout, and `amount` until the first quote loads.
 */
export interface ReviewPayout {
    currency: string
    /** Uppercase local currency the bank converts EUR into (a UK or Polish IBAN); null otherwise. */
    bankConvertsTo: string | null
    rate?: string
    amount?: string
    enteredInBankCurrency: boolean
}

/** Named screen ids for /withdraw/manteca. */
export const WITHDRAW_MANTECA_STEPS = ['bank-details', 'amount', 'review', 'success', 'failure'] as const
export type WithdrawMantecaStep = (typeof WITHDRAW_MANTECA_STEPS)[number]
