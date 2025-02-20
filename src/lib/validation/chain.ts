import { chains } from '@/constants'
import { Chain } from 'viem'
import { ChainValidationError } from '../url-parser/errors'
import { resolveChain } from './resolvers/chain-resolver'

export function validateChain(chainIdentifier: string | number): Chain {
    try {
        // convert number to hex string
        const identifier = typeof chainIdentifier === 'number' ? `0x${chainIdentifier.toString(16)}` : chainIdentifier

        // resolve chain
        const resolvedChain = resolveChain(identifier)

        // find matching chain from supported chains
        const chain = chains.find((c) => c.id.toString() === resolvedChain.id)
        if (!chain) {
            throw new ChainValidationError(`Chain not supported in current context: ${identifier}`)
        }

        return chain
    } catch (error) {
        throw new ChainValidationError(error instanceof Error ? error.message : `Invalid chain: ${chainIdentifier}`)
    }
}
