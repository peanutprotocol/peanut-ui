import { formatAmount } from '@/utils'
import { AmountValidationError } from '../url-parser/errors'

export function validateAmount(amount: string): {
    amount: string
} {
    const trimmedAmount = amount.trim()

    // allow empty string as valid
    if (!trimmedAmount) {
        return { amount: '' }
    }

    // check for valid number format using regex
    // matches: positive numbers, with optional decimal point
    if (!/^\d*\.?\d*$/.test(trimmedAmount)) {
        throw new AmountValidationError('Invalid amount')
    }

    const parsedAmount = parseFloat(trimmedAmount)

    // check for zero, NaN, or negative values
    if (parsedAmount === 0 || isNaN(parsedAmount) || parsedAmount < 0) {
        throw new AmountValidationError('Invalid amount')
    }

    return {
        amount: formatAmount(trimmedAmount),
    }
}
