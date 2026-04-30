import type { ChainWithTokens, TokenMeta } from '@/interfaces/chain-meta'
import { type Chain } from 'viem'

export type RecipientType = 'ENS' | 'ADDRESS' | 'USERNAME'
export type ChainId = Chain['id']

export interface ParsedURL {
    recipient: {
        identifier: string
        recipientType: RecipientType
        resolvedAddress: string
    } | null
    amount?: string
    token?: TokenMeta
    chain?: ChainWithTokens
}
