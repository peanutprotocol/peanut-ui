'use client'

import { useCallback, useEffect, useRef, type ReactNode } from 'react'
import { SumsubKycModals } from '@/components/Kyc/SumsubKycModals'
import { useToast } from '@/components/0_Bruddle/Toast'
import { QrKycState } from '@/constants/kyc.consts'
import { useAuth } from '@/context/authContext'
import { useCapabilities } from '@/hooks/useCapabilities'
import { useMultiPhaseKycFlow } from '@/hooks/useMultiPhaseKycFlow'
import { qrVerificationNeedsRestart, selectQrKycGate } from './qrKycGate.utils'

/**
 * The QR ID check started outside /qr-pay: Home's Verify row for a residence
 * with no bank rail and no card, and the "Unlock QR code payments" slide.
 *
 * Two things the QR pay page does for itself, done here too:
 * - An approval enables only the pay-only QR rails. The flow's own finish
 *   line waits for a bank deposit, which never comes for this user, so the
 *   flow closes as soon as the QR-pay gate opens (useQrPayKycGate's watcher).
 * - A start that fails has no screen of its own to show the error on, so it
 *   is a toast: never a tap that does nothing.
 */
export function useQrIdentityCheck(): { start: () => void; modals: ReactNode } {
    const flow = useMultiPhaseKycFlow({})
    const { user } = useAuth()
    const { capabilities, railsForProvider, nextActions, isLoading } = useCapabilities()
    const toast = useToast()
    const startedRef = useRef(false)

    const mantecaRails = railsForProvider('manteca')
    const canPayNow =
        selectQrKycGate({
            isLoading: isLoading || !user,
            features: capabilities.features,
            nextActions,
            rails: capabilities.rails,
        }).kycGateState === QrKycState.PROCEED_TO_PAY
    // An approved user whose identity evidence is missing: the start route
    // answers "already approved" and opens nothing, so this is the restart.
    const needsRestart = qrVerificationNeedsRestart({ mantecaRails, nextActions })

    const { showWrapper, isModalOpen, completeFlow, error } = flow
    useEffect(() => {
        if (!startedRef.current || !canPayNow) return
        if (showWrapper || isModalOpen) {
            startedRef.current = false
            completeFlow()
        }
    }, [canPayNow, showWrapper, isModalOpen, completeFlow])

    useEffect(() => {
        if (!error) return
        const id = toast.error(error)
        return () => toast.dismiss?.(id)
        // eslint-disable-next-line react-hooks/exhaustive-deps -- once per failed start
    }, [error])

    const { handleUnlockQr, handleRestartIdentity } = flow
    const start = useCallback(() => {
        startedRef.current = true
        if (needsRestart) void handleRestartIdentity()
        else void handleUnlockQr()
    }, [needsRestart, handleUnlockQr, handleRestartIdentity])

    return { start, modals: <SumsubKycModals flow={flow} /> }
}
