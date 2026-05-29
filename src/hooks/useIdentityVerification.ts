'use client'

import { useAuth } from '@/context/authContext'
import { type IdentityVerification, type IdentityVerificationStatus } from '@/types/capabilities'
import { useMemo } from 'react'

/**
 * Thin selector over the backend-computed identity-verification status — the
 * second KYC read-model, embedded TOP-LEVEL on /get-user (`user.identityVerification`,
 * sibling of `capabilities`).
 *
 * Provider-agnostic by design: this is the user's ONE identity check (documents).
 * Provider (Bridge/Manteca) approval is NOT here — it lives in useCapabilities()
 * rail statuses. The FE never learns a provider name from this hook.
 *
 * Replaces the per-provider status derivation the deleted KYC hooks did from the
 * raw bridgeKyc* / kycVerifications fields.
 */

const NOT_STARTED: IdentityVerification = { status: 'not_started' }

export interface UseIdentityVerificationResult {
    /** The raw identity block (not_started while loading / for logged-out users). */
    identity: IdentityVerification
    status: IdentityVerificationStatus
    isVerified: boolean
    isProcessing: boolean
    /** retryable — user can resubmit/add documents. */
    needsAction: boolean
    /** terminal — cannot self-serve. */
    isFailed: boolean
    isLoading: boolean
}

export function useIdentityVerification(): UseIdentityVerificationResult {
    const { user, isFetchingUser } = useAuth()
    const identity = user?.identityVerification ?? NOT_STARTED

    return useMemo(() => {
        const status = identity.status
        return {
            identity,
            status,
            isVerified: status === 'verified',
            isProcessing: status === 'processing',
            needsAction: status === 'action_required',
            isFailed: status === 'failed',
            isLoading: isFetchingUser,
        }
    }, [identity, isFetchingUser])
}
