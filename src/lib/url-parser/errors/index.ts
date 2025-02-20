export class ValidationError extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'ValidationError'
    }
}

export class RecipientValidationError extends ValidationError {
    constructor(message: string) {
        super(message)
        this.name = 'RecipientValidationError'
    }
}

export class TokenValidationError extends ValidationError {
    constructor(message: string) {
        super(message)
        this.name = 'TokenValidationError'
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
