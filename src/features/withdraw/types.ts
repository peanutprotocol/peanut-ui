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

/** Flow-level error banner state ({@link FlowErrorState.showError} + copy).
 * Field-level validation errors are `FieldError` under their input instead. */
export interface FlowErrorState {
    showError: boolean
    errorMessage: string
}

/** Named screen ids for the root /withdraw page — these appear verbatim in the URL. */
export const WITHDRAW_ROOT_STEPS = ['method', 'amount'] as const
export type WithdrawRootStep = (typeof WITHDRAW_ROOT_STEPS)[number]

/** Named screen ids for /withdraw/crypto. */
export const WITHDRAW_CRYPTO_STEPS = ['recipient', 'review', 'success'] as const
export type WithdrawCryptoStep = (typeof WITHDRAW_CRYPTO_STEPS)[number]

/** Named screen ids for /withdraw/[country]/bank. */
export const WITHDRAW_BANK_STEPS = ['review', 'success'] as const
export type WithdrawBankStep = (typeof WITHDRAW_BANK_STEPS)[number]

/** Named screen ids for /withdraw/manteca. */
export const WITHDRAW_MANTECA_STEPS = ['amount', 'bank-details', 'review', 'success', 'failure'] as const
export type WithdrawMantecaStep = (typeof WITHDRAW_MANTECA_STEPS)[number]
