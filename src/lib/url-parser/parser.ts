import { getSquidChainsAndTokens } from '@/app/actions/squid'
import { PEANUT_WALLET_CHAIN, PEANUT_WALLET_TOKEN } from '@/constants'
import { interfaces } from '@squirrel-labs/peanut-sdk'
import { validateAmount } from '../validation/amount'
import { validateAndResolveRecipient } from '../validation/recipient'
import { getChainDetails, getTokenAndChainDetails } from '../validation/token'
import { AmountValidationError } from './errors'
import { ParsedURL } from './types/payment'

function parseAmountAndToken(amountString: string): { amount?: string; token?: string } {
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
            return { token: amountString.toLowerCase() }
        }
        throw new AmountValidationError('Invalid amount format')
    }

    const [_, amount, token] = match

    return {
        amount: amount || undefined,
        token: token.toLowerCase(),
    }
}

export enum EParseUrlError {
    INVALED_URL_FORMAT = 'Invalid URL format',
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
    if (segments.length === 0) {
        return {
            parsedUrl: null,
            error: { message: EParseUrlError.INVALED_URL_FORMAT },
        }
    }

    // decode the first segment to handle URL encoding
    const firstSegment = decodeURIComponent(segments[0])
    let recipient = firstSegment
    let chain: string | undefined = undefined
    let chainDetails: (interfaces.ISquidChain & { tokens: interfaces.ISquidToken[] }) | undefined

    // handle multiple @ symbols - take the last one as chain identifier
    if (firstSegment.includes('@')) {
        const parts = firstSegment.split('@')
        if (parts.length > 2) {
            // handle multiple @'s - take first part as recipient, last part as chain
            recipient = parts.slice(0, -1).join('@')
            chain = parts[parts.length - 1]
        } else {
            const [recipientPart, chainPart] = parts
            recipient = recipientPart
            chain = chainPart
        }

        // handle empty chain part after @
        if (!chain || chain.trim() === '') {
            chain = undefined
        }
    }

    const [recipientResult, squidChainsResult] = await Promise.allSettled([
        validateAndResolveRecipient(recipient),
        getSquidChainsAndTokens(),
    ])

    if (recipientResult.status === 'rejected') {
        return { parsedUrl: null, error: { message: EParseUrlError.INVALID_RECIPIENT, recipient } }
    }

    if (squidChainsResult.status === 'rejected') {
        return { parsedUrl: null, error: { message: EParseUrlError.INVALED_URL_FORMAT } }
    }

    const recipientDetails = recipientResult.value
    const squidChainsAndTokens = squidChainsResult.value

    // resolve chain details if chain is specified
    if (chain) {
        try {
            chainDetails = getChainDetails(chain, squidChainsAndTokens)
        } catch (error) {
            return { parsedUrl: null, error: { message: EParseUrlError.INVALID_CHAIN, recipient } }
        }
    } else {
        // if no chain specified or invalid chain, use peanut wallet chain for username types
        if (recipientDetails.recipientType === 'USERNAME') {
            chainDetails = squidChainsAndTokens[PEANUT_WALLET_CHAIN.id]
        } else {
            chainDetails = undefined
        }
    }

    // handle amount and token parsing
    if (segments.length > 1) {
        const { amount, token } = parseAmountAndToken(segments[1])
        let validatedAmount = undefined
        if (amount) {
            try {
                validatedAmount = validateAmount(amount)
            } catch (error) {
                return { parsedUrl: null, error: { message: EParseUrlError.INVALID_AMOUNT, recipient } }
            }
        }

        // if token is specified, resolve it
        if (token) {
            let tokenAndChainData = await getTokenAndChainDetails(token, chain)

            const tokenDetails = tokenAndChainData?.token
            if (!tokenDetails) {
                return { parsedUrl: null, error: { message: EParseUrlError.INVALID_TOKEN, recipient } }
            }

            // set chain details for non USERNAME recipients
            if (!chainDetails && recipientDetails.recipientType !== 'USERNAME' && tokenAndChainData.chain) {
                chainDetails = tokenAndChainData.chain as interfaces.ISquidChain & { tokens: interfaces.ISquidToken[] }
            }

            return {
                parsedUrl: {
                    recipient: recipientDetails,
                    amount: validatedAmount?.amount,
                    token: tokenDetails ?? undefined,
                    chain: chainDetails,
                },
                error: null,
            }
        } else if (!token && recipientDetails.recipientType === 'USERNAME') {
            // use default Peanut Wallet token for USERNAME recipients
            const tokenDetails = chainDetails?.tokens.find(
                (t) => t.address.toLowerCase() === PEANUT_WALLET_TOKEN.toLowerCase()
            )
            return {
                parsedUrl: {
                    recipient: recipientDetails,
                    token: tokenDetails,
                    chain: chainDetails,
                    amount: validatedAmount?.amount,
                },
                error: null,
            }
        }

        // if only amount specified, return with current chain
        if (validatedAmount && !token && !chain) {
            return {
                parsedUrl: {
                    recipient: recipientDetails,
                    amount: validatedAmount.amount,
                    chain: undefined,
                    token: undefined,
                },
                error: null,
            }
        }
    }

    // base case: only recipient specified
    // return with default chain and token if recipient is a peanut user
    const defaultTokenDetails =
        recipientDetails.recipientType === 'USERNAME'
            ? chainDetails?.tokens.find((t) => t.address.toLowerCase() === PEANUT_WALLET_TOKEN.toLowerCase())
            : undefined

    return {
        parsedUrl: {
            recipient: recipientDetails,
            chain: chainDetails,
            token: defaultTokenDetails,
            amount: undefined,
        },
        error: null,
    }
}
