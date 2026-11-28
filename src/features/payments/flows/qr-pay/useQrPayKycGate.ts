'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useToast } from '@/components/0_Bruddle/Toast'
import { QrKycState } from '@/constants/kyc.consts'
import { useAuth } from '@/context/authContext'
import { useCapabilities } from '@/hooks/useCapabilities'
import { useIdentityVerification } from '@/hooks/useIdentityVerification'
import { useMultiPhaseKycFlow } from '@/hooks/useMultiPhaseKycFlow'
import { qrIdentityRestartReason, qrVerificationNeedsRestart, selectQrKycGate } from './qrKycGate.utils'

// The QR-pay KYC gate: the API's QR answer (`capabilities.features.qr`), via selectQrKycGate.
export function useQrPayKycGate() {
    const { capabilities, railsForProvider, nextActions, isLoading: isLoadingCapabilities } = useCapabilities()
    const { isTerminalFailure } = useIdentityVerification()
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
                features: capabilities.features,
                nextActions,
                rails: capabilities.rails,
            }),
        [isLoadingCapabilities, capabilities.features, capabilities.rails, nextActions, user, userFetchSettled]
    )

    const shouldBlockPay = kycGateState !== QrKycState.PROCEED_TO_PAY

    const sumsubFlow = useMultiPhaseKycFlow({})

    const needsIdentityRestart = useMemo(
        () => qrVerificationNeedsRestart({ mantecaRails: railsForProvider('manteca'), nextActions }),
        [railsForProvider, nextActions]
    )
    const identityRestartReason = useMemo(
        () => qrIdentityRestartReason({ mantecaRails: railsForProvider('manteca'), nextActions }),
        [railsForProvider, nextActions]
    )
    // The one "Verify identity" step of every QR screen. An approved user whose
    // identity evidence is missing needs the restart: the start route answers
    // "already approved" for them and opens nothing.
    const { handleRestartIdentity, handleUnlockQr } = sumsubFlow
    const startVerification = useCallback(() => {
        if (needsIdentityRestart) void handleRestartIdentity()
        else void handleUnlockQr()
    }, [needsIdentityRestart, handleRestartIdentity, handleUnlockQr])

    // No QR screen has room for an inline error, so a failed start is a toast:
    // never a tap that does nothing.
    const toast = useToast()
    const startError = sumsubFlow.error
    const refused = sumsubFlow.isQrUnlockRefused
    useEffect(() => {
        if (!startError || refused) return
        const id = toast.error(startError)
        return () => toast.dismiss?.(id)
        // eslint-disable-next-line react-hooks/exhaustive-deps -- once per failed start
    }, [startError, refused])

    // Auto-dismiss the Sumsub flow if the user's QR-pool rails become enabled
    // server-side while a flow is mid-air. The explicit QR start and
    // out-of-band capability changes can both publish an open gate.
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

    return {
        kycGateState,
        qrKycUserMessage,
        qrKycActionKey,
        shouldBlockPay,
        isTerminalFailure,
        needsIdentityRestart,
        identityRestartReason,
        startVerification,
        sumsubFlow,
    }
}
