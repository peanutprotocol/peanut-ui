import type { SignatureCheckOutcome } from './signup-test-transaction'

export type SignupTestTxPhase = 'prepare' | 'sign' | 'submit'

/** Where the final signup step failed: before the passkey, at the passkey, or at the bundler. */
export class SignupTestTxError extends Error {
    constructor(
        public readonly phase: SignupTestTxPhase,
        cause: unknown,
        public readonly signatureCheck?: SignatureCheckOutcome
    ) {
        super(cause instanceof Error ? cause.message : String(cause))
        this.name = 'SignupTestTxError'
        this.cause = cause
    }
}
