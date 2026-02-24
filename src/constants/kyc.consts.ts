import { type SumsubKycStatus } from '@/app/actions/types/sumsub.types'
import { type MantecaKycStatus } from '@/interfaces'

/**
 * unified kyc status type across all providers.
 * bridge uses lowercase strings, manteca uses its own enum, sumsub uses uppercase.
 */
export type KycVerificationStatus = MantecaKycStatus | SumsubKycStatus | string

export type KycStatusCategory = 'completed' | 'processing' | 'failed' | 'action_required'

// sets of status values by category — single source of truth
const APPROVED_STATUSES: ReadonlySet<string> = new Set(['approved', 'ACTIVE', 'APPROVED'])
const FAILED_STATUSES: ReadonlySet<string> = new Set(['rejected', 'INACTIVE', 'REJECTED'])
const PENDING_STATUSES: ReadonlySet<string> = new Set([
    'under_review',
    'incomplete',
    'ONBOARDING',
    'PENDING',
    'IN_REVIEW',
])
const ACTION_REQUIRED_STATUSES: ReadonlySet<string> = new Set(['ACTION_REQUIRED'])
const NOT_STARTED_STATUSES: ReadonlySet<string> = new Set(['not_started', 'NOT_STARTED'])

// sumsub-specific set for flow-level gating (e.g. useQrKycGate blocks payments).
// ACTION_REQUIRED is intentionally included here — user hasn't completed verification
// yet, so they should still be gated from features that require approved kyc.
const SUMSUB_IN_PROGRESS_STATUSES: ReadonlySet<string> = new Set(['PENDING', 'IN_REVIEW', 'ACTION_REQUIRED'])

/** check if a kyc status represents an approved/completed state */
export const isKycStatusApproved = (status: string | undefined | null): boolean =>
    !!status && APPROVED_STATUSES.has(status)

/** check if a kyc status represents a failed/rejected state */
export const isKycStatusFailed = (status: string | undefined | null): boolean => !!status && FAILED_STATUSES.has(status)

/** check if a kyc status represents a pending/in-review state */
export const isKycStatusPending = (status: string | undefined | null): boolean =>
    !!status && PENDING_STATUSES.has(status)

/** check if a kyc status represents an action-required state */
export const isKycStatusActionRequired = (status: string | undefined | null): boolean =>
    !!status && ACTION_REQUIRED_STATUSES.has(status)

/** check if a kyc status means "not started" (should not render status ui) */
export const isKycStatusNotStarted = (status: string | undefined | null): boolean =>
    !status || NOT_STARTED_STATUSES.has(status)

/** check if a sumsub status means verification is in progress */
export const isSumsubStatusInProgress = (status: string | undefined | null): boolean =>
    !!status && SUMSUB_IN_PROGRESS_STATUSES.has(status)

/** categorize any provider's kyc status into a display category */
export const getKycStatusCategory = (status: string): KycStatusCategory => {
    if (APPROVED_STATUSES.has(status)) return 'completed'
    if (FAILED_STATUSES.has(status)) return 'failed'
    if (ACTION_REQUIRED_STATUSES.has(status)) return 'action_required'
    return 'processing'
}
