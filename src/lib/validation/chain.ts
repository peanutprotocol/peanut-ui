import { chains } from '@/constants'
import { Chain } from 'viem'
import { ChainValidationError } from '../url-parser/errors'
import { normalizeChainName } from './chain-resolver'

export function validateChain(chainIdentifier: string | number): Chain {
    // find chain by ID
    if (typeof chainIdentifier === 'number') {
        const chain = chains.find((c) => c.id === chainIdentifier)
        if (chain) return chain
    }

    // find chain using normalized name
    if (typeof chainIdentifier === 'string') {
        const normalizedName = normalizeChainName(chainIdentifier)
        const chain = chains.find(
            (c) => normalizeChainName(c.name) === normalizedName || normalizeChainName(c.name) === normalizedName
        )

        if (chain) return chain
    }

    throw new ChainValidationError(`Unsupported chain: ${chainIdentifier}`)
}
