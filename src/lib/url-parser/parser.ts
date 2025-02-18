import { PEANUT_WALLET_CHAIN, PEANUT_WALLET_TOKEN_NAME } from '@/constants'
import { isAddress } from 'viem'
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
    let recipient = firstSegment
    let chain = undefined

    // if recipient contains @, extract chain info
    if (firstSegment.includes('@')) {
        const [recipientPart, chainPart] = firstSegment.split('@')
        recipient = recipientPart
        chain = chainPart // set the chain from the @ part
    }

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
            console.error('Chain resolution error:', error)
            // if chain resolution fails, still parse the address but without chain
            const baseResult: ParsedURL = {
                recipient: chainSpecificAddress.user,
                recipientType: detectRecipientType(chainSpecificAddress.user),
                chain: chain, // use the chain from @ if available
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

    // if not chain-specific, validate eth addresses
    if (firstSegment.startsWith('0x')) {
        if (!isAddress(firstSegment)) {
            throw new Error('Invalid Ethereum address format')
        }
    }

    // check if its peanut native username (no .eth suffix)
    if (!firstSegment.includes('.eth') && !isAddress(firstSegment)) {
        // if its peanut native username, extract just the username part if @ is present in segment
        const username = firstSegment.split('@')[0]

        // parse amount from remaining segments
        const { amount } = segments.length > 1 ? parseAmountAndToken(segments[1]) : { amount: undefined }

        // for peanut native usernames, always force Arbitrum and USDC
        return {
            recipient: username,
            recipientType: 'USERNAME',
            chain: PEANUT_WALLET_CHAIN.id.toString(),
            token: PEANUT_WALLET_TOKEN_NAME,
            ...(amount && { amount }),
        }
    }

    // handle remaining segments
    if (segments.length > 1) {
        const { amount, token } = parseAmountAndToken(segments[1])
        return {
            recipient,
            recipientType: detectRecipientType(recipient),
            chain: chain, // include the chain from @ if it was present
            ...(amount && { amount }),
            ...(token && { token }),
        }
    }

    return {
        recipient,
        recipientType: detectRecipientType(recipient),
        chain: chain, // include the chain from @ if it was present
    }
}
