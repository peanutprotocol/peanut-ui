import * as interfaces from '@/interfaces/peanut-sdk-types'
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
    token?: interfaces.ISquidToken
    chain?: interfaces.ISquidChain & { tokens: interfaces.ISquidToken[] }
}
