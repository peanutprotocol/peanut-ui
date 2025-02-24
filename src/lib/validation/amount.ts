import { AmountValidationError } from '../url-parser/errors'

export function validateAmount(amount: string): {
    amount: string
} {
    const parsedAmount = parseFloat(amount)

    if (parsedAmount === 0 || isNaN(parsedAmount) || parsedAmount < 0) {
        throw new AmountValidationError('Invalid amount')
    }

    return {
        amount,
    }
}
