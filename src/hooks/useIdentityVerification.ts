'use client'

import { useAuth } from '@/context/authContext'
import { IDENTITY_REGION_RESTRICTED_CODE } from '@/constants/kyc.consts'
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
    /**
     * Terminal AND caused by the document's jurisdiction. A strict subset of
     * `isFailed`: these users get the region screen (an explanation, no retry,
     * no support punt) instead of the generic failed treatment. Every surface
     * that renders a rejection must check this BEFORE `isFailed`, or it will
     * offer a retry that can never pass.
     */
    isRegionRestricted: boolean
    /**
     * Terminal for any reason OTHER than region — fraud, sanctions, age,
     * forgery. Distinct from `isRegionRestricted` because the right ending
     * differs: we deliberately do NOT explain these (naming the cause carries
     * compliance exposure and tips off the people it describes), and support IS
     * the right route, because a human can review a misclassification.
     *
     * Both are terminal, so neither may offer a retry.
     */
    isTerminalFailure: boolean
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
            // Gated on `failed` as well as the code: a reason riding a
            // non-terminal status would be the BE contradicting itself, and
            // rendering a dead end on a live flow is the worse failure.
            isRegionRestricted: status === 'failed' && identity.reason?.code === IDENTITY_REGION_RESTRICTED_CODE,
            // `canRetry !== true` rather than `=== false`: an older backend
            // omits the field entirely, and defaulting those to terminal is the
            // safe direction — a retry that cannot pass is worse than a support
            // link that wasn't strictly needed.
            isTerminalFailure:
                status === 'failed' &&
                identity.canRetry !== true &&
                identity.reason?.code !== IDENTITY_REGION_RESTRICTED_CODE,
            isLoading: isFetchingUser,
        }
    }, [identity, isFetchingUser])
}
