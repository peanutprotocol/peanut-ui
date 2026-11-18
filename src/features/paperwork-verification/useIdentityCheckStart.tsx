'use client'

import { type ReactNode, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { InitiateKycModal } from '@/components/Kyc/InitiateKycModal'
import { useAuth } from '@/context/authContext'
import { useModalsContext } from '@/context/ModalsContext'
import { useQrIdentityCheck } from '@/features/payments/flows/qr-pay/useQrIdentityCheck'
import { usePaperworkVerificationStart } from '@/features/paperwork-verification/usePaperworkVerificationStart'
import type { useMultiPhaseKycFlow } from '@/hooks/useMultiPhaseKycFlow'
import { useResidenceRestrictions } from '@/hooks/useResidenceRestrictions'
import { buildContactSupportMessage } from '@/utils/contact-support.utils'

/**
 * The one ID-check start, shared by Home's Verify row and the sign-up Celebration. Both open the one verify
 * screen: Verify start on /verify, or over the page for today's check. The caller owns the KYC flow and renders
 * its SumsubKycModals, because Home reuses that flow for its other cards. `modals` holds the start modal and the
 * QR check's modals.
 */
export function useIdentityCheckStart(
    kycFlow: ReturnType<typeof useMultiPhaseKycFlow>,
    {
        replace = false,
        onClose,
    }: {
        /** /verify takes the caller's place (sign-up): Back from it must not reopen the caller */
        replace?: boolean
        /** after the start modal closes without starting the check (its Remind me later) */
        onClose?: () => void
    } = {}
): {
    start: () => Promise<void>
    modals: ReactNode
} {
    const router = useRouter()
    const { user } = useAuth()
    const { openSupportWithMessage } = useModalsContext()
    const qrIdentityCheck = useQrIdentityCheck()
    // The start modal is the one the bank and deposit gates use: its outage, region and residence checks run here too.
    const [showInitiateKyc, setShowInitiateKyc] = useState(false)
    // Smart Paperwork Verification users go straight to the question screens,
    // wherever they live: its questions cover every feature the residence opens.
    const opensPaperworkVerification = usePaperworkVerificationStart()
    const restrictions = useResidenceRestrictions()
    const startingRef = useRef(false)
    const start = async () => {
        if (startingRef.current) return
        startingRef.current = true
        try {
            if (await opensPaperworkVerification()) {
                if (replace) router.replace('/verify')
                else router.push('/verify')
            }
            // The legacy start is bank-shaped. Where bank rails are closed the
            // card is the door, and where the card is closed too, QR pay is
            // (Hugo, 2026-09-26: QR is open to every verified user).
            else if (!restrictions.banking) setShowInitiateKyc(true)
            else if (!restrictions.card) router.push('/card')
            else qrIdentityCheck.start()
        } finally {
            startingRef.current = false
        }
    }
    // the SDK takes over the screen; the modal that opened it should not stay behind it
    useEffect(() => {
        if (kycFlow.showWrapper) setShowInitiateKyc(false)
    }, [kycFlow.showWrapper])

    const modals = (
        <>
            <InitiateKycModal
                cooldownActive={!!kycFlow.errorCooldown}
                visible={showInitiateKyc}
                onClose={() => {
                    setShowInitiateKyc(false)
                    onClose?.()
                }}
                // no corridor: the one ID check, the same start the status drawer resumes
                onVerify={() => void kycFlow.handleInitiateKyc()}
                onContactSupport={() => {
                    setShowInitiateKyc(false)
                    openSupportWithMessage(buildContactSupportMessage({ userId: user?.user?.userId }))
                }}
                isLoading={kycFlow.isLoading}
                error={kycFlow.error}
            />
            {qrIdentityCheck.modals}
        </>
    )
    return { start, modals }
}
