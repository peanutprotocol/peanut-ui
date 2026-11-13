export class ConnectionTimeoutError extends Error {
    readonly interrupted?: true

    constructor(cause: Error, interrupted = false) {
        super('Peanut is taking too long to respond — check your connection and try again.', { cause })
        this.name = 'ConnectionTimeoutError'
        if (interrupted) this.interrupted = true
    }
}

export class MutationResponseTimeoutError extends ConnectionTimeoutError {
    readonly responseReceived = true
    readonly outcomeUnknown = true

    constructor(
        public readonly status: number,
        cause: Error
    ) {
        super(cause)
        this.name = 'MutationResponseTimeoutError'
        this.message = `Response body timed out after HTTP ${status}; request outcome is unknown.`
    }
}
