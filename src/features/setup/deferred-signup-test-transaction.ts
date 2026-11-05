import posthog from 'posthog-js'
import { captureException, captureMessage } from '@sentry/nextjs'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import {
    submitSignedUserOperation,
    userOpFailureKind,
    type SubmissionBudget,
    type SubmissionDeps,
} from '@/utils/userop-submission'
import {
    clearSignupTestTransaction,
    DEFERRED_RETRY_LIMIT,
    readSignupTestTransaction,
    updateSignupTestTransaction,
    type SignupTestTransaction,
} from './signup-test-transaction'

/** One app start's attempt: 2 sends 3 s apart, one 30 s receipt wait, 45 s in all. */
export const DEFERRED_SIGNUP_TEST_TX_SUBMISSION: SubmissionBudget = {
    sendAttempts: 2,
    backoffMs: [3_000],
    receiptWindows: 1,
    receiptWindowMs: 30_000,
    totalMs: 45_000,
}

export type DeferredSignupTestTxOutcome = 'mined' | 'pending' | 'expired' | 'signature_rejected' | 'gave_up'

export interface DeferredSignupTestTxBundler {
    send: (record: SignupTestTransaction) => Promise<`0x${string}`>
    waitForReceipt: SubmissionDeps['waitForReceipt']
    getReceipt: SubmissionDeps['getReceipt']
    nonceSpent: (record: SignupTestTransaction) => Promise<boolean>
}

/**
 * The later retry of a confirmation the person finished signup without. It
 * resends the operation signed during signup, unchanged, so it never prompts
 * for the passkey. An operation that can no longer be included (expired
 * sponsorship, spent nonce) ends the retry: its signature already passed the
 * validator's checks on the device, which is what deferring required, and the
 * first real payment deploys the account with the same passkey.
 */
export async function retryDeferredSignupTestTransaction(
    userId: string,
    bundler: DeferredSignupTestTxBundler,
    {
        budget = DEFERRED_SIGNUP_TEST_TX_SUBMISSION,
        sleep,
    }: { budget?: SubmissionBudget; sleep?: (ms: number) => Promise<void> } = {}
): Promise<DeferredSignupTestTxOutcome | null> {
    const record = readSignupTestTransaction(userId)
    if (!record?.deferred || record.mined) return null
    const retries = record.deferredRetries + 1
    const settle = (outcome: DeferredSignupTestTxOutcome) => {
        clearSignupTestTransaction(userId)
        posthog.capture(ANALYTICS_EVENTS.SIGNUP_TEST_TX_DEFERRED_RESOLVED, { outcome, retries })
        return outcome
    }

    try {
        await submitSignedUserOperation(
            record.userOpHash,
            {
                send: () => bundler.send(record),
                waitForReceipt: bundler.waitForReceipt,
                getReceipt: bundler.getReceipt,
                nonceSpent: () => bundler.nonceSpent(record),
                sleep,
            },
            budget
        )
        return settle('mined')
    } catch (error) {
        const kind = userOpFailureKind(error)
        if (kind === 'signature_invalid') {
            captureException(error, {
                level: 'error',
                tags: { error_type: 'signup_deferred_signature_rejected' },
                extra: { sender: record.sender, signatureCheck: record.signatureCheck },
            })
            return settle('signature_rejected')
        }
        if (kind === 'expired' || kind === 'nonce_used') return settle('expired')
        if (retries >= DEFERRED_RETRY_LIMIT) {
            captureMessage('Deferred signup confirmation never landed', {
                level: 'warning',
                tags: { error_type: 'signup_deferred_gave_up' },
                extra: { sender: record.sender, kind },
            })
            return settle('gave_up')
        }
        updateSignupTestTransaction(userId, { deferredRetries: retries })
        return 'pending'
    }
}
