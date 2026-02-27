import { useState, useCallback, useRef, useEffect } from 'react'
import { useAuth } from '@/context/authContext'
import { useSumsubKycFlow } from '@/hooks/useSumsubKycFlow'
import { useRailStatusTracking } from '@/hooks/useRailStatusTracking'
import { getBridgeTosLink, confirmBridgeTos } from '@/app/actions/users'
import { type KycModalPhase } from '@/interfaces'
import { type KYCRegionIntent } from '@/app/actions/types/sumsub.types'

const PREPARING_TIMEOUT_MS = 30000

/**
 * confirms bridge ToS acceptance (with one retry) then polls fetchUser
 * until bridge rails leave REQUIRES_INFORMATION. max 3 attempts × 2s.
 */
export async function confirmBridgeTosAndAwaitRails(fetchUser: () => Promise<any>) {
    const result = await confirmBridgeTos()
    if (!result.data?.accepted) {
        await new Promise((resolve) => setTimeout(resolve, 2000))
        await confirmBridgeTos()
    }

    for (let i = 0; i < 3; i++) {
        const updatedUser = await fetchUser()
        const stillNeedsTos = (updatedUser?.rails ?? []).some(
            (r: any) => r.rail.provider.code === 'BRIDGE' && r.status === 'REQUIRES_INFORMATION'
        )
        if (!stillNeedsTos) break
        if (i < 2) await new Promise((resolve) => setTimeout(resolve, 2000))
    }
}

interface UseMultiPhaseKycFlowOptions {
    onKycSuccess?: () => void
    onManualClose?: () => void
    regionIntent?: KYCRegionIntent
}

/**
 * reusable hook that wraps useSumsubKycFlow + useRailStatusTracking
 * to provide a complete multi-phase kyc flow:
 *   verifying → preparing → bridge_tos (if applicable) → complete
 *
 * use this hook anywhere kyc is initiated. pair with SumsubKycModals
 * for the modal rendering.
 */
export const useMultiPhaseKycFlow = ({ onKycSuccess, onManualClose, regionIntent }: UseMultiPhaseKycFlowOptions) => {
    const { fetchUser } = useAuth()

    // multi-phase modal state
    const [modalPhase, setModalPhase] = useState<KycModalPhase>('verifying')
    const [forceShowModal, setForceShowModal] = useState(false)
    const [preparingTimedOut, setPreparingTimedOut] = useState(false)
    const preparingTimerRef = useRef<NodeJS.Timeout | null>(null)
    const isRealtimeFlowRef = useRef(false)

    // bridge ToS state
    const [tosLink, setTosLink] = useState<string | null>(null)
    const [showTosIframe, setShowTosIframe] = useState(false)
    const [tosError, setTosError] = useState<string | null>(null)
    const [isLoadingTos, setIsLoadingTos] = useState(false)

    // ref for closeVerificationProgressModal (avoids circular dep with completeFlow)
    const closeVerificationModalRef = useRef<() => void>(() => {})

    // rail tracking
    const { allSettled, needsBridgeTos, startTracking, stopTracking } = useRailStatusTracking()

    const clearPreparingTimer = useCallback(() => {
        if (preparingTimerRef.current) {
            clearTimeout(preparingTimerRef.current)
            preparingTimerRef.current = null
        }
    }, [])

    // complete the flow — close everything, call original onKycSuccess
    const completeFlow = useCallback(() => {
        isRealtimeFlowRef.current = false
        setForceShowModal(false)
        setModalPhase('verifying')
        setPreparingTimedOut(false)
        setTosLink(null)
        setShowTosIframe(false)
        setTosError(null)
        clearPreparingTimer()
        stopTracking()
        closeVerificationModalRef.current()
        onKycSuccess?.()
    }, [onKycSuccess, clearPreparingTimer, stopTracking])

    // called when sumsub status transitions to APPROVED
    const handleSumsubApproved = useCallback(async () => {
        // for real-time flow, optimistically show "Identity verified!" while we check rails
        if (isRealtimeFlowRef.current) {
            setModalPhase('preparing')
            setForceShowModal(true)
        }

        const updatedUser = await fetchUser()
        const rails = updatedUser?.rails ?? []

        const bridgeNeedsTos = rails.some(
            (r) => r.rail.provider.code === 'BRIDGE' && r.status === 'REQUIRES_INFORMATION'
        )

        if (bridgeNeedsTos) {
            setModalPhase('bridge_tos')
            setForceShowModal(true)
            clearPreparingTimer()
            return
        }

        const anyPending = rails.some((r) => r.status === 'PENDING')

        if (anyPending || (rails.length === 0 && isRealtimeFlowRef.current)) {
            // rails still being set up — show preparing and start tracking
            setModalPhase('preparing')
            setForceShowModal(true)
            startTracking()
            return
        }

        // all settled — done
        completeFlow()
    }, [fetchUser, startTracking, clearPreparingTimer, completeFlow])

    const {
        isLoading,
        error,
        showWrapper,
        accessToken,
        liveKycStatus,
        handleInitiateKyc: originalHandleInitiateKyc,
        handleSdkComplete: originalHandleSdkComplete,
        handleClose,
        refreshToken,
        isVerificationProgressModalOpen,
        closeVerificationProgressModal,
    } = useSumsubKycFlow({ onKycSuccess: handleSumsubApproved, onManualClose, regionIntent })

    // keep ref in sync
    useEffect(() => {
        closeVerificationModalRef.current = closeVerificationProgressModal
    }, [closeVerificationProgressModal])

    // refresh user store when kyc status transitions to a non-success state
    // so the drawer/status item reads the updated verification record
    useEffect(() => {
        if (liveKycStatus === 'ACTION_REQUIRED' || liveKycStatus === 'REJECTED') {
            fetchUser()
        }
    }, [liveKycStatus, fetchUser])

    // wrap handleSdkComplete to track real-time flow
    const handleSdkComplete = useCallback(() => {
        isRealtimeFlowRef.current = true
        originalHandleSdkComplete()
    }, [originalHandleSdkComplete])

    // wrap handleInitiateKyc to reset state for new attempts
    const handleInitiateKyc = useCallback(
        async (overrideIntent?: KYCRegionIntent, levelName?: string) => {
            setModalPhase('verifying')
            setForceShowModal(false)
            setPreparingTimedOut(false)
            setTosLink(null)
            setShowTosIframe(false)
            setTosError(null)
            isRealtimeFlowRef.current = false
            clearPreparingTimer()

            await originalHandleInitiateKyc(overrideIntent, levelName)
        },
        [originalHandleInitiateKyc, clearPreparingTimer]
    )

    // 30s timeout for preparing phase
    useEffect(() => {
        if (modalPhase === 'preparing' && !preparingTimedOut) {
            clearPreparingTimer()
            preparingTimerRef.current = setTimeout(() => {
                setPreparingTimedOut(true)
            }, PREPARING_TIMEOUT_MS)
        } else {
            clearPreparingTimer()
        }
    }, [modalPhase, preparingTimedOut, clearPreparingTimer])

    // phase transitions driven by rail tracking
    useEffect(() => {
        if (modalPhase === 'preparing') {
            if (needsBridgeTos) {
                setModalPhase('bridge_tos')
                clearPreparingTimer()
            } else if (allSettled) {
                setModalPhase('complete')
                clearPreparingTimer()
                stopTracking()
            }
        } else if (modalPhase === 'bridge_tos') {
            // after ToS accepted, rails transition to ENABLED
            if (allSettled && !needsBridgeTos) {
                setModalPhase('complete')
                stopTracking()
            }
        }
    }, [modalPhase, needsBridgeTos, allSettled, clearPreparingTimer, stopTracking])

    // handle "Accept Terms" click in bridge_tos phase
    const handleAcceptTerms = useCallback(async () => {
        setIsLoadingTos(true)
        setTosError(null)

        try {
            const response = await getBridgeTosLink()

            if (response.error || !response.data?.tosLink) {
                setTosError(
                    response.error || 'Could not load terms. You can accept them later from your activity feed.'
                )
                return
            }

            setTosLink(response.data.tosLink)
            setShowTosIframe(true)
        } catch {
            setTosError('Something went wrong. You can accept terms later from your activity feed.')
        } finally {
            setIsLoadingTos(false)
        }
    }, [])

    // handle ToS iframe close
    const handleTosIframeClose = useCallback(
        async (source?: 'manual' | 'completed' | 'tos_accepted') => {
            setShowTosIframe(false)

            if (source === 'tos_accepted') {
                // show loading state while confirming + polling
                setModalPhase('preparing')
                await confirmBridgeTosAndAwaitRails(fetchUser)
                completeFlow()
            }
            // if manual close, stay on bridge_tos phase (user can try again)
        },
        [fetchUser, completeFlow]
    )

    // handle "Skip for now" in bridge_tos phase
    const handleSkipTerms = useCallback(() => {
        completeFlow()
    }, [completeFlow])

    // handle modal close (Go to Home, etc.)
    const handleModalClose = useCallback(() => {
        isRealtimeFlowRef.current = false
        setForceShowModal(false)
        clearPreparingTimer()
        stopTracking()
        closeVerificationProgressModal()
    }, [clearPreparingTimer, stopTracking, closeVerificationProgressModal])

    // cleanup on unmount
    useEffect(() => {
        return () => {
            clearPreparingTimer()
            stopTracking()
        }
    }, [clearPreparingTimer, stopTracking])

    const isModalOpen = isVerificationProgressModalOpen || forceShowModal

    return {
        // initiation
        handleInitiateKyc,
        isLoading,
        error,
        liveKycStatus,

        // SDK wrapper
        showWrapper,
        accessToken,
        handleSdkClose: handleClose,
        handleSdkComplete,
        refreshToken,

        // multi-phase modal
        isModalOpen,
        modalPhase,
        handleModalClose,
        handleAcceptTerms,
        handleSkipTerms,
        completeFlow,
        tosError,
        isLoadingTos,
        preparingTimedOut,

        // ToS iframe
        tosLink,
        showTosIframe,
        handleTosIframeClose,
    }
}
