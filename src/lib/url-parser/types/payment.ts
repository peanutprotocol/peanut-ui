import { interfaces } from '@squirrel-labs/peanut-sdk'
import { type Chain } from 'viem'

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
    /** @dev: flag indicating if this is a devconnect flow (external address + base chain), to be deleted post devconnect */
    isDevConnectFlow?: boolean
}
