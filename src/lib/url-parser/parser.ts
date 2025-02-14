import { isAddress } from 'viem'
import { arbitrum } from 'viem/chains'
import { resolveChainId } from '../validation/resolvers/chain-resolver'
import { parseChainSpecificAddress } from './parsers/address.parser'
import { ParsedURL, RecipientType } from './types/payment'

export function detectRecipientType(recipient: string): RecipientType {
    if (recipient.endsWith('.eth')) return 'ENS'
    if (isAddress(recipient)) return 'ADDRESS'
    return 'USERNAME'
}

// helper function to split amount and token
function parseAmountAndToken(amountString: string): { amount?: string; token?: string } {
    // match number part (including decimals) and potential token part
    const match = amountString.match(/^(\d*\.?\d*)([a-zA-Z]+)?$/)

    if (!match) {
        // if it's just a number with no token
        if (/^\d*\.?\d*$/.test(amountString)) {
            return { amount: amountString }
        }
        return {}
    }

    const [_, amount, token] = match
    // normalize token to uppercase for consistency
    return {
        amount: amount || undefined,
        token: token ? token.toUpperCase() : undefined,
    }
}

export function parsePaymentURL(segments: string[]): ParsedURL {
    if (segments.length === 0) {
        throw new Error('Invalid URL format: No recipient specified')
    }

    // decode the first segment to handle URL encoding
    const firstSegment = decodeURIComponent(segments[0])

    // parse chain-specific address if present
    const chainSpecificAddress = parseChainSpecificAddress(firstSegment)
    if (chainSpecificAddress) {
        const remainingSegments = segments.slice(1)
        try {
            // resolve chain ID from chain-specific address
            const chainId = resolveChainId(chainSpecificAddress.chain)

            const baseResult: ParsedURL = {
                recipient: chainSpecificAddress.user,
                recipientType: detectRecipientType(chainSpecificAddress.user),
                chain: chainId,
            }

            // if there's an amount segment, parse it for both amount and token
            if (remainingSegments.length > 0) {
                const { amount, token } = parseAmountAndToken(remainingSegments[0])
                return {
                    ...baseResult,
                    ...(amount && { amount }),
                    ...(token && { token }),
                }
            }

            return baseResult
        } catch (error) {
            // if chain resolution fails, still parse the address but without chain
            const baseResult: ParsedURL = {
                recipient: chainSpecificAddress.user,
                recipientType: detectRecipientType(chainSpecificAddress.user),
            }

            // if there's an amount segment, parse it for both amount and token
            if (remainingSegments.length > 0) {
                const { amount, token } = parseAmountAndToken(remainingSegments[0])
                return {
                    ...baseResult,
                    ...(amount && { amount }),
                    ...(token && { token }),
                }
            }

            return baseResult
        }
    }

    // handle non-chain-specific addresses
    // if there's a second segment, parse it for both amount and token
    if (segments.length > 1) {
        const { amount, token } = parseAmountAndToken(segments[1])
        return {
            recipient: firstSegment,
            recipientType: detectRecipientType(firstSegment),
            chain: arbitrum.id.toString(), // default to arbitrum
            ...(amount && { amount }),
            ...(token && { token }),
        }
    }

    // retirn recipient only if no amount or token is specified
    return {
        recipient: firstSegment,
        recipientType: detectRecipientType(firstSegment),
        chain: arbitrum.id.toString(), // default to arbitrum
    }
}
