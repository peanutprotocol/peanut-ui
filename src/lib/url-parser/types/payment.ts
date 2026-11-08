import type { ChainWithTokens, TokenMeta } from '@/interfaces/chain-meta'
import type { Person } from '@/lib/person/person.types'
import { type Chain } from 'viem'

export type RecipientType = 'ENS' | 'ADDRESS' | 'USERNAME'
export type ChainId = Chain['id']

/** A Peanut handle carries the person behind it, so every view can draw their
 *  avatar (TASK-23756); an address or ENS name has nobody behind it. */
export type RecipientPerson =
    | { recipientType: Extract<RecipientType, 'USERNAME'>; person: Person }
    | { recipientType: Exclude<RecipientType, 'USERNAME'>; person: null }

export type ResolvedRecipient = RecipientPerson & {
    identifier: string
    resolvedAddress: string
}

export interface ParsedURL {
    recipient: ResolvedRecipient | null
    amount?: string
    token?: TokenMeta
    chain?: ChainWithTokens
}
