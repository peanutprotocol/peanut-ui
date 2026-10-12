export class ValidationError extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'ValidationError'
    }
}

/**
 * Rejections the recipient classifier decides locally, with no network call.
 * The `message` stays a readable English sentence for logs and for call sites
 * that show it raw; a `code` lets the input component show translated copy
 * instead. Omitted for errors that come back from a resolver.
 */
export type RecipientValidationCode = 'ARGENTINE_ALIAS' | 'INVALID_ENS' | 'UNSUPPORTED_WITHDRAW_RECIPIENT'

export class RecipientValidationError extends ValidationError {
    readonly code?: RecipientValidationCode

    constructor(message: string, code?: RecipientValidationCode) {
        super(message)
        this.name = 'RecipientValidationError'
        this.code = code
    }
}

export class ChainValidationError extends ValidationError {
    constructor(message: string) {
        super(message)
        this.name = 'ChainValidationError'
    }
}

export class AmountValidationError extends ValidationError {
    constructor(message: string) {
        super(message)
        this.name = 'AmountValidationError'
    }
}
