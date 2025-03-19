import { getSquidChainsAndTokens } from '@/app/actions/squid'
import { PEANUT_WALLET_CHAIN, PEANUT_WALLET_TOKEN, PINTA_WALLET_TOKEN } from '@/constants'
import { interfaces } from '@squirrel-labs/peanut-sdk'
import { validateAmount } from '../validation/amount'
import { validateAndResolveRecipient } from '../validation/recipient'
import { getChainDetails, getTokenAndChainDetails } from '../validation/token'
import { AmountValidationError } from './errors'
import { ParsedURL } from './types/payment'
import { areEvmAddressesEqual } from '@/utils'

export function parseAmountAndToken(amountString: string): { amount?: string; token?: string } {
    // remove all whitespace
    amountString = amountString.trim()

    // handle empty string
    if (!amountString) {
        return {}
    }

    // match number part (including decimals) followed by token part
    // this regx will match patterns like "0.1usdc", "100eth", "1.5pol"
    const match = amountString.match(/^(\d*\.?\d*)([a-zA-Z]+)$/)

    if (!match) {
        // if it's just a number with no token
        if (/^\d*\.?\d*$/.test(amountString)) {
            return { amount: amountString }
        }
        // if it's just a token with no amount
        if (/^[a-zA-Z]+$/.test(amountString)) {
            let token = amountString.toLowerCase()
            token = token === 'matic' ? 'pol' : token
            return { token }
        }
        throw new AmountValidationError('Invalid amount format')
    }

    const [_, amount, token] = match

    return {
        amount: amount || undefined,
        token: token.toLowerCase() === 'matic' ? 'pol' : token.toLowerCase(),
    }
}

function mustBeInteger(tokenAddress: string): boolean {
    return areEvmAddressesEqual(tokenAddress, PINTA_WALLET_TOKEN)
}

export enum EParseUrlError {
    INVALID_URL_FORMAT = 'Invalid URL format',
    INVALID_RECIPIENT = 'Invalid recipient',
    INVALID_CHAIN = 'Invalid chain',
    INVALID_TOKEN = 'Invalid token',
    INVALID_AMOUNT = 'Invalid amount',
}

export type ParseUrlError = {
    message: `${EParseUrlError}`
    recipient?: string
}

export async function parsePaymentURL(
    segments: string[]
): Promise<{ parsedUrl: ParsedURL; error: null } | { parsedUrl: null; error: ParseUrlError }> {
    // 1. Input validation - check if segments array is empty
    if (segments.length === 0) {
        return {
            parsedUrl: null,
            error: { message: EParseUrlError.INVALID_URL_FORMAT },
        }
    }

    // 2. Extract recipient and chain from first segment
    const firstSegment = decodeURIComponent(segments[0])
    let recipient = firstSegment
    let chainId: string | undefined = undefined
    if (firstSegment.includes('@')) {
        const parts = firstSegment.split('@')
        if (parts.length > 2) {
            // handle multiple @'s - take first part as recipient, last part as chain
            recipient = parts.slice(0, -1).join('@')
            chainId = parts[parts.length - 1]
        } else {
            const [recipientPart, chainPart] = parts
            recipient = recipientPart
            chainId = chainPart
        }
        // handle empty chain part after @
        if (!chainId || chainId.trim() === '') {
            chainId = undefined
        }
    }

    // 3. Fetch and validate recipient and chains/tokens data
    const [recipientResult, squidChainsResult] = await Promise.allSettled([
        validateAndResolveRecipient(recipient),
        getSquidChainsAndTokens(),
    ])
    if (recipientResult.status === 'rejected') {
        return { parsedUrl: null, error: { message: EParseUrlError.INVALID_RECIPIENT, recipient } }
    }
    if (squidChainsResult.status === 'rejected') {
        return { parsedUrl: null, error: { message: EParseUrlError.INVALID_URL_FORMAT } }
    }
    const recipientDetails = recipientResult.value
    const squidChainsAndTokens = squidChainsResult.value
    const isPeanutRecipient = recipientDetails.recipientType === 'USERNAME'

    // 4. Resolve chain details
    let chainDetails: (interfaces.ISquidChain & { tokens: interfaces.ISquidToken[] }) | undefined = undefined
    if (chainId) {
        try {
            chainDetails = getChainDetails(chainId, squidChainsAndTokens)
            if (isPeanutRecipient && PEANUT_WALLET_CHAIN.id.toString() !== chainDetails.chainId) {
                throw new Error('Invalid chain')
            }
        } catch (error) {
            return { parsedUrl: null, error: { message: EParseUrlError.INVALID_CHAIN, recipient } }
        }
    } else if (isPeanutRecipient) {
        // If no chain specified, use peanut wallet chain for username types
        chainDetails = squidChainsAndTokens[PEANUT_WALLET_CHAIN.id]
    }

    // 5. Handle amount and token parsing from second segment
    let parsedAmount: { amount: string } | undefined = undefined
    let tokenDetails: interfaces.ISquidToken | undefined = undefined
    if (segments.length > 1) {
        const { amount, token } = parseAmountAndToken(segments[1])
        if (amount) {
            try {
                parsedAmount = validateAmount(amount)
            } catch (error) {
                return { parsedUrl: null, error: { message: EParseUrlError.INVALID_AMOUNT, recipient } }
            }
        }
        if (token) {
            if (!chainDetails && !isPeanutRecipient) {
                // default to arb even for non-USERNAME recipients if no chain is specified
                chainDetails = squidChainsAndTokens[PEANUT_WALLET_CHAIN.id]
            }
            const tokenAndChainData = await getTokenAndChainDetails(token, chainId)
            tokenDetails = tokenAndChainData?.token

            if (!tokenDetails) {
                return { parsedUrl: null, error: { message: EParseUrlError.INVALID_TOKEN, recipient } }
            }

            // Update chain details for non-USERNAME recipients if needed
            if (!chainDetails && !isPeanutRecipient && tokenAndChainData.chain) {
                chainDetails = tokenAndChainData.chain as interfaces.ISquidChain & { tokens: interfaces.ISquidToken[] }
            }

            //validate reward amount
            if (
                parsedAmount?.amount &&
                mustBeInteger(tokenDetails.address) &&
                !Number.isInteger(Number(parsedAmount.amount))
            ) {
                return { parsedUrl: null, error: { message: EParseUrlError.INVALID_AMOUNT, recipient } }
            }
        } else if (isPeanutRecipient) {
            tokenDetails = chainDetails?.tokens.find(
                (t) => t.address.toLowerCase() === PEANUT_WALLET_TOKEN.toLowerCase()
            )
        } else if (chainDetails) {
            tokenDetails = chainDetails.tokens.find((t) => t.symbol.toLowerCase() === 'USDC'.toLowerCase())
        }
    } else if (isPeanutRecipient) {
        tokenDetails = chainDetails?.tokens.find((t) => t.address.toLowerCase() === PEANUT_WALLET_TOKEN.toLowerCase())
    } else if (chainDetails) {
        tokenDetails = chainDetails.tokens.find((t) => t.symbol.toLowerCase() === 'USDC'.toLowerCase())
    }

    // 6. Construct and return the final result
    return {
        parsedUrl: {
            recipient: recipientDetails,
            amount: parsedAmount?.amount,
            token: tokenDetails,
            chain: chainDetails,
        },
        error: null,
    }
}
