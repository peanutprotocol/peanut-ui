import { parseUnits } from 'viem'
import { AmountValidationError } from '../url-parser/errors'
import { TokenInfo } from '../url-parser/types/token'

export function validateAmount(amount: string, token?: TokenInfo): { value: string; formatted: string } {
    // basic amount validation
    if (!amount || amount === '0') {
        throw new AmountValidationError('Amount must be greater than 0')
    }

    const numericAmount = parseFloat(amount)

    // if amount is not a number, throw an error
    if (isNaN(numericAmount)) {
        throw new AmountValidationError('Invalid amount format')
    }

    // token-specific validation if token is provided
    if (token) {
        const minAmount = parseFloat(token.minAmount || '0')
        const maxAmount = parseFloat(token.maxAmount || Infinity.toString())

        // check if amount is within token's min and max amounts
        if (numericAmount < minAmount) {
            throw new AmountValidationError(`Amount must be at least ${minAmount} ${token.symbol}`)
        }

        if (numericAmount > maxAmount) {
            throw new AmountValidationError(`Amount cannot exceed ${maxAmount} ${token.symbol}`)
        }

        // check if amount is a multiple of the token's decimals
        try {
            const value = parseUnits(amount, token?.decimals || 18)
            return {
                value: value.toString(),
                formatted: amount,
            }
        } catch (error) {
            throw new AmountValidationError('Invalid amount precision')
        }
    }

    // default validation for when token is not specified
    return {
        // todo: thought, probably take the decimals from the token info
        value: parseUnits(amount, 18).toString(),
        formatted: amount,
    }
}
