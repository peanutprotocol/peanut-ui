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
    if (trimmedAmount.length > 1024 || !/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(trimmedAmount)) {
        throw new AmountValidationError('Invalid amount')
    }

    const parsedAmount = parseFloat(trimmedAmount)

    // check for zero, NaN, or negative values
    if (parsedAmount === 0 || !Number.isFinite(parsedAmount) || parsedAmount < 0) {
        throw new AmountValidationError('Invalid amount')
    }

    return { amount: trimmedAmount }
}

/** Strict raw payment amount, shared by UI eligibility and execution guards. */
export function isPositiveFiniteAmount(amount: string): boolean {
    try {
        return validateAmount(amount).amount !== ''
    } catch {
        return false
    }
}
