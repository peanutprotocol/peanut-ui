'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { QrKycState } from '@/constants/kyc.consts'
import { useAuth } from '@/context/authContext'
import { useCapabilities } from '@/hooks/useCapabilities'
import { useIdentityVerification } from '@/hooks/useIdentityVerification'
import { useMultiPhaseKycFlow } from '@/hooks/useMultiPhaseKycFlow'
import { railUserMessage, railVerdict } from '@/utils/capability-gate'

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
    const { isRegionRestricted } = useIdentityVerification()
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

    const { kycGateState, qrKycUserMessage, qrKycActionKey } = useMemo(() => {
        const noAction = null as string | null
        // Keep the gate in LOADING until either the user is hydrated OR the fallback
        // fetch has resolved. Otherwise we briefly map an empty capability shape onto
        // REQUIRES_IDENTITY_VERIFICATION for users whose auth state hasn't settled yet.
        if (isLoadingCapabilities || (!user && !userFetchSettled)) {
            return { kycGateState: QrKycState.LOADING, qrKycUserMessage: noAction, qrKycActionKey: noAction }
        }
        // Above the enabled-pay return, not just the rail-derived states below.
        // A terminal jurisdictional refusal is account-wide, but nothing revokes
        // a pool rail granted by an earlier approval — so a residence change
        // that re-verifies into a region rejection leaves an ENABLED rail
        // behind, and ranking `canDo` first would keep the money path open on
        // an identity we can no longer verify. Deliberately unlike deriveGate's
        // ready-wins hoist, which exists to stop a STUCK SIBLING rail from
        // blocking a working one — a refused identity is not a sibling rail.
        if (isRegionRestricted) {
            return { kycGateState: QrKycState.REGION_RESTRICTED, qrKycUserMessage: noAction, qrKycActionKey: noAction }
        }
        if (canDo('pay', { provider: 'manteca' })) {
            return { kycGateState: QrKycState.PROCEED_TO_PAY, qrKycUserMessage: noAction, qrKycActionKey: noAction }
        }
        // Verdict-first via the shared railVerdict collapse (rail.resolved,
        // BE-derived; legacy fallback for older/cached responses). The
        // US-nationality refinement is applied in the resolver itself
        // (Sumsub-approved + US-restricted → operations.pay enabled, caught by
        // canDo above), so a blocked verdict is genuine.
        const actionByKey = new Map(nextActions.map((action) => [action.key, action]))
        const candidates = railsForProvider('manteca').map((rail) => ({
            rail,
            verdict: railVerdict(rail, actionByKey),
        }))
        // provide-email is NOT a document fix: routing it into the Sumsub
        // upload flow dead-ends the user, and this surface has no email form —
        // map it to the blocked modal (same rule as deriveProviderRejection).
        const isProvideEmail = ({ verdict }: (typeof candidates)[number]) =>
            verdict.blocking?.selfHealKind === 'provide-email'
        const blocked = candidates.find(
            (candidate) => candidate.verdict.status === 'blocked' || isProvideEmail(candidate)
        )
        if (blocked) {
            // Country-not-supported is self-fixable: user uploaded a non-AR/BR doc
            // and can verify again with a different one. Split out for the right CTA.
            // (selfHealKind is the verdict home; the reason-code check covers legacy
            // responses — the code rides on blocking.code verbatim.)
            if (
                !isProvideEmail(blocked) &&
                (blocked.verdict.blocking?.selfHealKind === 'restart-identity' ||
                    blocked.verdict.blocking?.code === 'country_not_supported')
            ) {
                return {
                    kycGateState: QrKycState.PROVIDER_RESTART_IDENTITY,
                    qrKycUserMessage: railUserMessage(blocked.rail),
                    qrKycActionKey: noAction,
                }
            }
            return {
                kycGateState: QrKycState.PROVIDER_REJECTION_BLOCKED,
                qrKycUserMessage: railUserMessage(blocked.rail),
                qrKycActionKey: noAction,
            }
        }
        const fixable = candidates.find((candidate) => candidate.verdict.status === 'fixable')
        if (fixable) {
            const action = fixable.verdict.nextAction
            return {
                kycGateState: QrKycState.PROVIDER_REJECTION_FIXABLE,
                qrKycUserMessage: railUserMessage(fixable.rail),
                qrKycActionKey: action?.kind === 'sumsub' ? action.key : noAction,
            }
        }
        if (candidates.some(({ verdict }) => verdict.status === 'pending')) {
            return {
                kycGateState: QrKycState.IDENTITY_VERIFICATION_IN_PROGRESS,
                qrKycUserMessage: noAction,
                qrKycActionKey: noAction,
            }
        }
        return {
            kycGateState: QrKycState.REQUIRES_IDENTITY_VERIFICATION,
            qrKycUserMessage: noAction,
            qrKycActionKey: noAction,
        }
    }, [isLoadingCapabilities, canDo, railsForProvider, nextActions, user, userFetchSettled, isRegionRestricted])

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
