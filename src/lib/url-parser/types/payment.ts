import { interfaces } from '@squirrel-labs/peanut-sdk'
import { Chain } from 'viem'

export type RecipientType = 'ENS' | 'ADDRESS' | 'USERNAME'
export type ChainId = Chain['id']

export interface ParsedURL {
    recipient: {
        identifier: string
        recipientType: RecipientType
        resolvedAddress: string
    }
    amount?: string
    token?: interfaces.ISquidToken
    chain?: interfaces.ISquidChain & { tokens: interfaces.ISquidToken[] }
}
