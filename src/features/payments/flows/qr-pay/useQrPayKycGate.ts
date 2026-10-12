'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { QrKycState } from '@/constants/kyc.consts'
import { useAuth } from '@/context/authContext'
import { useCapabilities } from '@/hooks/useCapabilities'
import { useIdentityVerification } from '@/hooks/useIdentityVerification'
import { useMultiPhaseKycFlow } from '@/hooks/useMultiPhaseKycFlow'
import { selectQrKycGate } from './qrKycGate.utils'

// MIGRATION-REVIEW: QR-pay KYC gate, formerly useQrKycGate + useKycStatus.
// Derived inline from the backend capability model. Mapping:
//   canDo('pay',{manteca}) → PROCEED_TO_PAY. The BE resolver expresses both
//     paths uniformly as an enabled pay op: Sumsub-approved pool users AND
//     Sumsub-approved US-nationality-restricted users alike (compliance
//     ratified 2026-05-28). No FE special-case needed.
//   manteca top-level 'blocked' → PROVIDER_REJECTION_BLOCKED (genuine block —
//     no Sumsub, or a non-restriction final rejection).
//   manteca top-level 'requires-info' → PROVIDER_REJECTION_FIXABLE.
//   manteca 'pending' → IDENTITY_VERIFICATION_IN_PROGRESS.
//   otherwise → REQUIRES_IDENTITY_VERIFICATION. While loading → LOADING.
// userMessage ← the rejecting rail's reason.userMessage (was useProviderRejectionStatus).
export function useQrPayKycGate() {
    const { canDo, railsForProvider, nextActions, isKycApproved, isLoading: isLoadingCapabilities } = useCapabilities()
    const { isRegionRestricted, isTerminalFailure } = useIdentityVerification()
    const { user, fetchUser } = useAuth()

    // On public routes (qr-pay) auth still auto-fetches via React Query, but trigger a one-shot
    // fetch if we landed with no user and nothing in flight, mirroring the old hook's fallback.
    // `userFetchSettled` flips to true once the fallback fetch resolves (success OR fail) so the
    // memo below can keep the gate in LOADING until then — without it, the empty-capabilities
    // shape on a cold load would flash REQUIRES_IDENTITY_VERIFICATION for one paint.
    const hasRequestedUserFetchRef = useRef(false)
    const [userFetchSettled, setUserFetchSettled] = useState(false)
    useEffect(() => {
        if (!user && !isLoadingCapabilities && !hasRequestedUserFetchRef.current) {
            hasRequestedUserFetchRef.current = true
            void fetchUser().finally(() => setUserFetchSettled(true))
        }
    }, [user, isLoadingCapabilities, fetchUser])

    const { kycGateState, qrKycUserMessage, qrKycActionKey } = useMemo(
        () =>
            selectQrKycGate({
                // Keep the gate in LOADING until either the user is hydrated OR the fallback
                // fetch has resolved. Otherwise we briefly map an empty capability shape onto
                // REQUIRES_IDENTITY_VERIFICATION for users whose auth state hasn't settled yet.
                isLoading: isLoadingCapabilities || (!user && !userFetchSettled),
                isRegionRestricted,
                isTerminalFailure,
                canPayManteca: canDo('pay', { provider: 'manteca' }),
                mantecaRails: railsForProvider('manteca'),
                nextActions,
            }),
        [
            isLoadingCapabilities,
            canDo,
            railsForProvider,
            nextActions,
            user,
            userFetchSettled,
            isRegionRestricted,
            isTerminalFailure,
        ]
    )

    const shouldBlockPay = kycGateState !== QrKycState.PROCEED_TO_PAY

    const sumsubFlow = useMultiPhaseKycFlow({})

    // Auto-dismiss the Sumsub flow if the user's QR-pool rails become enabled
    // server-side while a flow is mid-air. Two known sources:
    //   1. The `/users/identity` LATAM re-entry path now calls
    //      `enableQrPoolRails()` BEFORE returning the Manteca action token
    //      (peanut-api-ts #920) — so the BE can hand back a Sumsub token AND
    //      have just unlocked QR access in the same request. Without this,
    //      the SDK pops on top of an already-unlocked user.
    //   2. Out-of-band capability updates (sibling-tab refresh, manual
    //      backfill, etc.) flip the gate to PROCEED_TO_PAY while the modal
    //      is still open. Same outcome — close it.
    // Cheap watcher, zero added latency on the happy path: relies on the
    // existing useUserAutoRefresh / fetchUser polling already in place.
    useEffect(() => {
        if (kycGateState !== QrKycState.PROCEED_TO_PAY) return
        if (sumsubFlow.showWrapper || sumsubFlow.isModalOpen) {
            sumsubFlow.completeFlow()
        }
        // Field-level deps are complete for this body. useMultiPhaseKycFlow returns a fresh
        // object each render, so depending on sumsubFlow itself would re-fire every render
        // and call completeFlow() repeatedly.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [kycGateState, sumsubFlow.showWrapper, sumsubFlow.isModalOpen, sumsubFlow.completeFlow])

    return { kycGateState, qrKycUserMessage, qrKycActionKey, shouldBlockPay, isKycApproved, sumsubFlow }
}
