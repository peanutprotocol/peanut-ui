import { isAa24Error } from '@/utils/walletCredential.utils'
import { userOpFailureKind, UserOpSubmissionError, type UserOpFailureKind } from '@/utils/userop-submission'
import { classifyPasskeyError, type PasskeyErrorCode } from '@/utils/webauthn.utils'
import { SignupTestTxError, type SignupTestTxPhase } from './signup-test-tx-error'

/**
 * - signature_invalid: the validator rejects this passkey's signatures (AA24). Retrying cannot help.
 * - bundler_transient: the network or the bundler failed; the same operation can still succeed.
 * - needs_new_signature: the signed operation can no longer be included; confirming again signs a new one.
 * - passkey: the passkey prompt itself failed (cancelled, locked, unsupported…).
 * - unknown: none of the above.
 */
export type SignupTestTxFailureMode =
    | 'signature_invalid'
    | 'bundler_transient'
    | 'needs_new_signature'
    | 'passkey'
    | 'unknown'

export interface SignupTestTxFailure {
    mode: SignupTestTxFailureMode
    phase?: SignupTestTxPhase
    submissionKind: UserOpFailureKind
    errorCode?: PasskeyErrorCode
    rootCause: Error
}

const asError = (value: unknown) => (value instanceof Error ? value : new Error(String(value)))

export function classifySignupTestTxFailure(error: unknown): SignupTestTxFailure {
    const phase = error instanceof SignupTestTxError ? error.phase : undefined
    const inner = phase ? (error as SignupTestTxError).cause : error
    const submissionError = inner instanceof UserOpSubmissionError ? inner : null
    const unwrapped = submissionError ? submissionError.cause : inner
    // viem wraps a signer or bundler rejection in UserOperationExecutionError with the real failure in `cause`.
    const rootCause = asError(
        unwrapped instanceof Error && unwrapped.cause instanceof Error ? unwrapped.cause : unwrapped
    )
    const submissionKind = userOpFailureKind(inner)
    const result = (mode: SignupTestTxFailureMode, errorCode?: PasskeyErrorCode): SignupTestTxFailure => ({
        mode,
        phase,
        submissionKind,
        errorCode,
        rootCause,
    })

    if (submissionKind === 'signature_invalid' || isAa24Error(rootCause)) return result('signature_invalid')
    // An unrecognised passkey failure is mostly a prompt that closed without a reason; a retry usually works.
    if (phase === 'sign') return result('passkey', classifyPasskeyError(rootCause).code)
    if (phase === 'submit' && (submissionKind === 'expired' || submissionKind === 'nonce_used')) {
        return result('needs_new_signature')
    }
    // Without a phase the error may come from the passkey prompt, whose cancel reads "timed out or was not allowed".
    if (!phase) {
        const { code } = classifyPasskeyError(rootCause)
        if (code !== 'LOGIN_ERROR' && code !== 'NETWORK') return result('passkey', code)
    }
    if (submissionKind === 'transient' || submissionKind === 'already_known') return result('bundler_transient')
    return result('unknown')
}
