import { Chain } from 'viem'
import { TokenInfo } from './token'

export type RecipientType = 'ENS' | 'ADDRESS' | 'USERNAME'
export type ChainId = Chain['id']

export interface ParsedURL {
    recipient: string
    recipientType: RecipientType
    chain?: string
    amount?: string
    token?: string
}

export interface ValidatedPayment extends ParsedURL {
    resolvedAddress: string
    validatedAmount?: {
        value: string
        formatted: string
    }
    validatedToken?: {
        info: TokenInfo
        address?: string // optional for native tokens
        isNative: boolean
    }
    validatedChain?: Chain
}
