import { getSquidChainsAndTokens } from '@/app/actions/squid'
import { PEANUT_WALLET_CHAIN, PEANUT_WALLET_TOKEN } from '@/constants'
import { interfaces } from '@squirrel-labs/peanut-sdk'
import { validateAmount } from '../validation/amount'
import { validateAndResolveRecipient } from '../validation/recipient'
import { getChainDetails, getTokenAndChainDetails } from '../validation/token'
import { AmountValidationError, ChainValidationError, RecipientValidationError } from './errors'
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

export async function parsePaymentURL(segments: string[]): Promise<ParsedURL> {
    if (segments.length === 0) {
        throw new RecipientValidationError('Invalid URL format: No recipient specified')
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
        throw recipientResult.reason // Re-throw to be caught by caller
    }

    if (squidChainsResult.status === 'rejected') {
        throw new Error(`Failed to fetch chain and token data: ${squidChainsResult.reason.message}`)
    }

    const recipientDetails = recipientResult.value
    const squidChainsAndTokens = squidChainsResult.value

    // resolve chain details if chain is specified
    if (chain) {
        try {
            chainDetails = getChainDetails(chain, squidChainsAndTokens)
        } catch (error) {
            if (error instanceof ChainValidationError) {
                chainDetails = undefined
            } else {
                throw error
            }
        }
    }

    if (!chainDetails) {
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
        const validatedAmount = amount && validateAmount(amount)

        // if token is specified, resolve it
        if (token) {
            let tokenAndChainData = await getTokenAndChainDetails(token, chain)

            const tokenDetails = tokenAndChainData?.token

            // set chain details for non USERNAME recipients
            if (!chainDetails && recipientDetails.recipientType !== 'USERNAME' && tokenAndChainData.chain) {
                chainDetails = tokenAndChainData.chain as interfaces.ISquidChain & { tokens: interfaces.ISquidToken[] }
            }

            return {
                recipient: recipientDetails,
                amount: typeof validatedAmount === 'object' ? validatedAmount.amount : undefined,
                token: tokenDetails ?? undefined,
                chain: chainDetails,
            }
        } else if (!token && recipientDetails.recipientType === 'USERNAME') {
            // use default Peanut Wallet token for USERNAME recipients
            const tokenDetails = chainDetails?.tokens.find(
                (t) => t.address.toLowerCase() === PEANUT_WALLET_TOKEN.toLowerCase()
            )
            return {
                recipient: recipientDetails,
                token: tokenDetails,
                chain: chainDetails,
                ...(validatedAmount && { amount: validatedAmount.amount }),
            }
        }

        // if only amount specified, return with current chain
        if (validatedAmount && !token && !chain) {
            return {
                recipient: recipientDetails,
                amount: validatedAmount.amount,
                chain: undefined,
                token: undefined,
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
        recipient: recipientDetails,
        chain: chainDetails,
        token: defaultTokenDetails,
        amount: undefined,
    }
}
