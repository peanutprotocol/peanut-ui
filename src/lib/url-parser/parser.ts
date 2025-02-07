import { isAddress } from 'viem'
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
    return {
        amount: amount || undefined,
        token: token || undefined,
    }
}

export function parsePaymentURL(segments: string[]): ParsedURL {
    if (segments.length === 0) {
        throw new Error('Invalid URL format: No recipient specified')
    }

    // decode the first segment to handle URL encoding
    const firstSegment = decodeURIComponent(segments[0])

    // if the first segment contains @, it's a recipient with chain
    if (firstSegment.includes('@')) {
        const [recipient, chain] = firstSegment.split('@')
        const remainingSegments = segments.slice(1)

        // if there's an amount segment, parse it for both amount and token
        if (remainingSegments.length > 0) {
            const { amount, token } = parseAmountAndToken(remainingSegments[0])
            return {
                recipient,
                recipientType: detectRecipientType(recipient),
                chain,
                ...(amount && { amount }),
                ...(token && { token }),
            }
        }

        return {
            recipient,
            recipientType: detectRecipientType(recipient),
            chain,
        }
    }

    // if there's a second segment, parse it for both amount and token
    if (segments.length > 1) {
        const { amount, token } = parseAmountAndToken(segments[1])
        return {
            recipient: firstSegment,
            recipientType: detectRecipientType(firstSegment),
            ...(amount && { amount }),
            ...(token && { token }),
        }
    }

    // retirn recipient only if no amount or token is specified
    return {
        recipient: firstSegment,
        recipientType: detectRecipientType(firstSegment),
    }
}
