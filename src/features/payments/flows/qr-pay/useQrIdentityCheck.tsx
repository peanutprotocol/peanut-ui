'use client'

import { useCallback, useEffect, useRef, type ReactNode } from 'react'
import { SumsubKycModals } from '@/components/Kyc/SumsubKycModals'
import { useToast } from '@/components/0_Bruddle/Toast'
import { QrKycState } from '@/constants/kyc.consts'
import { useAuth } from '@/context/authContext'
import { useCapabilities } from '@/hooks/useCapabilities'
import { useIdentityVerification } from '@/hooks/useIdentityVerification'
import { useMultiPhaseKycFlow } from '@/hooks/useMultiPhaseKycFlow'
import { QR_IDENTITY_CHECK_INTENT, selectQrKycGate } from './qrKycGate.utils'

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
    const { canDo, railsForProvider, nextActions, isLoading } = useCapabilities()
    const { isRegionRestricted, isTerminalFailure } = useIdentityVerification()
    const toast = useToast()
    const startedRef = useRef(false)

    const canPayNow =
        selectQrKycGate({
            isLoading: isLoading || !user,
            isRegionRestricted,
            isTerminalFailure,
            canPayManteca: canDo('pay', { provider: 'manteca' }),
            mantecaRails: railsForProvider('manteca'),
            nextActions,
        }).kycGateState === QrKycState.PROCEED_TO_PAY

    const { showWrapper, isModalOpen, completeFlow, error } = flow
    useEffect(() => {
        if (!startedRef.current || !canPayNow) return
        if (showWrapper || isModalOpen) {
            startedRef.current = false
            completeFlow()
        }
    }, [canPayNow, showWrapper, isModalOpen, completeFlow])

    useEffect(() => {
        if (error) toast.error(error)
        // eslint-disable-next-line react-hooks/exhaustive-deps -- once per failed start
    }, [error])

    const { handleInitiateKyc } = flow
    const start = useCallback(() => {
        startedRef.current = true
        void handleInitiateKyc(QR_IDENTITY_CHECK_INTENT)
    }, [handleInitiateKyc])

    return { start, modals: <SumsubKycModals flow={flow} /> }
}
