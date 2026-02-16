import { type SumsubKycStatus, type KYCRegionIntent } from '@/app/actions/types/sumsub.types'
import { type MantecaKycStatus } from '@/interfaces'

// sumsub level names configured in the sumsub dashboard
const SUMSUB_LEVEL_NAMES: Record<KYCRegionIntent, string> = {
    STANDARD: 'peanut-kyc-standard',
    LATAM: 'peanut-kyc-latam',
}

/** resolve a region intent to the corresponding sumsub level name */
export const getSumsubLevelName = (regionIntent: KYCRegionIntent): string => SUMSUB_LEVEL_NAMES[regionIntent]

/**
 * unified kyc status type across all providers.
 * bridge uses lowercase strings, manteca uses its own enum, sumsub uses uppercase.
 */
export type KycVerificationStatus = MantecaKycStatus | SumsubKycStatus | string

export type KycStatusCategory = 'approved' | 'pending' | 'failed'

// sets of status values by category — single source of truth
const APPROVED_STATUSES: ReadonlySet<string> = new Set(['approved', 'ACTIVE', 'APPROVED'])
const FAILED_STATUSES: ReadonlySet<string> = new Set(['rejected', 'INACTIVE', 'REJECTED', 'ACTION_REQUIRED'])
const PENDING_STATUSES: ReadonlySet<string> = new Set([
    'under_review',
    'incomplete',
    'ONBOARDING',
    'PENDING',
    'IN_REVIEW',
])
const NOT_STARTED_STATUSES: ReadonlySet<string> = new Set(['not_started', 'NOT_STARTED'])

// sumsub-specific sets for checks that only care about sumsub
const SUMSUB_IN_PROGRESS_STATUSES: ReadonlySet<string> = new Set(['PENDING', 'IN_REVIEW', 'ACTION_REQUIRED'])

/** check if a kyc status represents an approved/completed state */
export const isKycStatusApproved = (status: string | undefined | null): boolean =>
    !!status && APPROVED_STATUSES.has(status)

/** check if a kyc status represents a failed/rejected state */
export const isKycStatusFailed = (status: string | undefined | null): boolean => !!status && FAILED_STATUSES.has(status)

/** check if a kyc status represents a pending/in-review state */
export const isKycStatusPending = (status: string | undefined | null): boolean =>
    !!status && PENDING_STATUSES.has(status)

/** check if a kyc status means "not started" (should not render status ui) */
export const isKycStatusNotStarted = (status: string | undefined | null): boolean =>
    !status || NOT_STARTED_STATUSES.has(status)

/** check if a sumsub status means verification is in progress */
export const isSumsubStatusInProgress = (status: string | undefined | null): boolean =>
    !!status && SUMSUB_IN_PROGRESS_STATUSES.has(status)

/** categorize any provider's kyc status into a display category */
export const getKycStatusCategory = (status: string): 'processing' | 'completed' | 'failed' => {
    if (APPROVED_STATUSES.has(status)) return 'completed'
    if (FAILED_STATUSES.has(status)) return 'failed'
    return 'processing'
}
