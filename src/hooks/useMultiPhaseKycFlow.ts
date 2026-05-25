import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { useAuth } from '@/context/authContext'
import { useSumsubKycFlow } from '@/hooks/useSumsubKycFlow'
import { useRailStatusTracking } from '@/hooks/useRailStatusTracking'
import { getBridgeTosLink, confirmBridgeTos } from '@/app/actions/users'
import { type IUserProfile, type KycModalPhase } from '@/interfaces'
import { type KYCRegionIntent } from '@/app/actions/types/sumsub.types'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'

const PREPARING_TIMEOUT_MS = 30000
const BRIDGE_ACTION_AUTO_CONTINUE_TIMEOUT_MS = 20000
const BRIDGE_ACTION_AUTO_CONTINUE_INTERVAL_MS = 2000

function wait(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === 'object'
}

function getBridgeRemediationFromUser(userProfile?: IUserProfile | null): Record<string, unknown> | null {
    const bridgeVerification = userProfile?.user?.kycVerifications
        ?.filter((verification) => verification.provider === 'BRIDGE')
        .sort((a, b) => new Date(b.updatedAt ?? 0).getTime() - new Date(a.updatedAt ?? 0).getTime())[0]
    const verificationRemediation = bridgeVerification?.metadata?.bridgeRemediation
    if (isRecord(verificationRemediation)) return verificationRemediation

    const railRemediation = userProfile?.rails
        ?.filter((rail) => rail.rail.provider.code === 'BRIDGE')
        .map((rail) => rail.metadata?.bridgeRemediation)
        .find(isRecord)

    return railRemediation ?? null
}

export function getBridgeNextQuestionnaireClusterFromUser(userProfile?: IUserProfile | null): string | null {
    const bridgeRemediation = getBridgeRemediationFromUser(userProfile)
    if (bridgeRemediation?.status !== 'AWAITING_INPUT') return null

    const nextAction = bridgeRemediation.nextAction
    if (!isRecord(nextAction)) return null

    const questionnaireCluster = nextAction.questionnaireCluster
    return typeof questionnaireCluster === 'string' ? questionnaireCluster : null
}

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
    const { fetchUser, user } = useAuth()
    const acquisitionSource = user?.invitedBy ? 'referred' : 'organic'

    // multi-phase modal state
    const [modalPhase, setModalPhase] = useState<KycModalPhase>('verifying')
    const [forceShowModal, setForceShowModal] = useState(false)
    const [preparingTimedOut, setPreparingTimedOut] = useState(false)
    const [preparingElapsed, setPreparingElapsed] = useState(0)
    const preparingTimerRef = useRef<NodeJS.Timeout | null>(null)
    const preparingElapsedIntervalRef = useRef<NodeJS.Timeout | null>(null)
    const isRealtimeFlowRef = useRef(false)
    const isMountedRef = useRef(true)

    // bridge ToS state
    const [tosLink, setTosLink] = useState<string | null>(null)
    const [showTosIframe, setShowTosIframe] = useState(false)
    const [tosError, setTosError] = useState<string | null>(null)
    const [isLoadingTos, setIsLoadingTos] = useState(false)

    // ref for closeVerificationProgressModal (avoids circular dep with completeFlow)
    const closeVerificationModalRef = useRef<() => void>(() => {})

    // rail tracking
    const { allSettled, needsBridgeTos, startTracking, stopTracking } = useRailStatusTracking()

    useEffect(() => {
        return () => {
            isMountedRef.current = false
        }
    }, [])

    const clearPreparingTimer = useCallback(() => {
        if (preparingTimerRef.current) {
            clearTimeout(preparingTimerRef.current)
            preparingTimerRef.current = null
        }
        if (preparingElapsedIntervalRef.current) {
            clearInterval(preparingElapsedIntervalRef.current)
            preparingElapsedIntervalRef.current = null
        }
    }, [])

    // complete the flow — close everything, call original onKycSuccess
    const completeFlow = useCallback(() => {
        posthog.capture(
            regionIntent === 'LATAM' ? ANALYTICS_EVENTS.MANTECA_KYC_COMPLETED : ANALYTICS_EVENTS.KYC_APPROVED,
            { region_intent: regionIntent, acquisition_source: acquisitionSource }
        )
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
    }, [onKycSuccess, clearPreparingTimer, stopTracking, regionIntent, acquisitionSource])

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
        handleSelfHealResubmit,
        handleSdkComplete: originalHandleSdkComplete,
        handleClose,
        refreshToken,
        isVerificationProgressModalOpen,
        closeVerificationProgressModal,
        isActionFlow,
        lastSelfHealQuestionnaireCluster,
    } = useSumsubKycFlow({ onKycSuccess: handleSumsubApproved, onManualClose, regionIntent })

    // keep ref in sync
    useEffect(() => {
        closeVerificationModalRef.current = closeVerificationProgressModal
    }, [closeVerificationProgressModal])

    // refresh user store when kyc status transitions to a non-success state
    // so the drawer/status item reads the updated verification record
    useEffect(() => {
        if (liveKycStatus === 'ACTION_REQUIRED' || liveKycStatus === 'REJECTED') {
            posthog.capture(ANALYTICS_EVENTS.KYC_REJECTED, {
                region_intent: regionIntent,
                status: liveKycStatus,
            })
            fetchUser()
        }
    }, [liveKycStatus, fetchUser, regionIntent])

    const handleActionFlowComplete = useCallback(async () => {
        setModalPhase('checking')
        setForceShowModal(true)

        // the second SDK completion happens after React records the TIN cluster from the first auto-continue.
        const canAutoContinueTin = lastSelfHealQuestionnaireCluster !== 'eea_tin_reupload'
        try {
            for (
                let elapsed = 0;
                elapsed < BRIDGE_ACTION_AUTO_CONTINUE_TIMEOUT_MS;
                elapsed += BRIDGE_ACTION_AUTO_CONTINUE_INTERVAL_MS
            ) {
                if (!isMountedRef.current) return

                let updatedUser
                try {
                    updatedUser = await fetchUser()
                } catch (error) {
                    console.error('[useMultiPhaseKycFlow] failed to refresh user during action continuation', error)
                    if (elapsed + BRIDGE_ACTION_AUTO_CONTINUE_INTERVAL_MS < BRIDGE_ACTION_AUTO_CONTINUE_TIMEOUT_MS) {
                        await wait(BRIDGE_ACTION_AUTO_CONTINUE_INTERVAL_MS)
                    }
                    continue
                }
                if (!isMountedRef.current) return

                const nextCluster = getBridgeNextQuestionnaireClusterFromUser(updatedUser)

                if (nextCluster === 'eea_tin_reupload' && canAutoContinueTin) {
                    const started = await handleSelfHealResubmit('BRIDGE')
                    if (!isMountedRef.current) return
                    if (started) {
                        setForceShowModal(false)
                        return
                    }
                    console.warn('[useMultiPhaseKycFlow] failed to start EEA TIN reupload continuation')
                    break
                }

                if (nextCluster === 'eea_tin_reupload') {
                    await wait(BRIDGE_ACTION_AUTO_CONTINUE_INTERVAL_MS)
                    break
                }
                if (elapsed + BRIDGE_ACTION_AUTO_CONTINUE_INTERVAL_MS < BRIDGE_ACTION_AUTO_CONTINUE_TIMEOUT_MS) {
                    await wait(BRIDGE_ACTION_AUTO_CONTINUE_INTERVAL_MS)
                }
            }
        } catch (error) {
            console.error('[useMultiPhaseKycFlow] action continuation failed', error)
        }

        if (!isMountedRef.current) return
        setModalPhase('preparing')
        setForceShowModal(true)
        startTracking()
    }, [fetchUser, handleSelfHealResubmit, lastSelfHealQuestionnaireCluster, startTracking])

    // wrap handleSdkComplete to track real-time flow
    const handleSdkComplete = useCallback(() => {
        posthog.capture(ANALYTICS_EVENTS.KYC_SUBMITTED, { region_intent: regionIntent })
        isRealtimeFlowRef.current = true
        originalHandleSdkComplete()
        // for action flows (manteca, self-heal), the base status is already APPROVED
        // and won't transition — directly start the preparing/tracking phase
        if (isActionFlow) {
            void handleActionFlowComplete()
        }
    }, [originalHandleSdkComplete, handleActionFlowComplete, isActionFlow, regionIntent])

    // wrap handleInitiateKyc to reset state for new attempts
    const handleInitiateKyc = useCallback(
        async (overrideIntent?: KYCRegionIntent, levelName?: string, crossRegion?: boolean, targetCountry?: string) => {
            const intent = overrideIntent ?? regionIntent
            posthog.capture(
                intent === 'LATAM' ? ANALYTICS_EVENTS.MANTECA_KYC_INITIATED : ANALYTICS_EVENTS.KYC_INITIATED,
                { region_intent: intent, acquisition_source: acquisitionSource }
            )

            setModalPhase('verifying')
            setForceShowModal(false)
            setPreparingTimedOut(false)
            setTosLink(null)
            setShowTosIframe(false)
            setTosError(null)
            isRealtimeFlowRef.current = false
            clearPreparingTimer()

            await originalHandleInitiateKyc(overrideIntent, levelName, crossRegion, targetCountry)
        },
        [originalHandleInitiateKyc, clearPreparingTimer, regionIntent, acquisitionSource]
    )

    // 30s timeout for preparing phase + elapsed time counter for progressive copy
    useEffect(() => {
        if (modalPhase === 'preparing' && !preparingTimedOut) {
            clearPreparingTimer()
            preparingTimerRef.current = setTimeout(() => {
                setPreparingTimedOut(true)
            }, PREPARING_TIMEOUT_MS)
            // Start elapsed time counter for progressive copy stages
            preparingElapsedIntervalRef.current = setInterval(() => {
                setPreparingElapsed((prev) => prev + 1)
            }, 1000)
        } else {
            clearPreparingTimer()
            // Reset elapsed time when leaving preparing phase
            if (modalPhase !== 'preparing') {
                setPreparingElapsed(0)
            }
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
                posthog.capture(ANALYTICS_EVENTS.KYC_TOS_ACCEPTED)
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
        posthog.capture(
            regionIntent === 'LATAM' ? ANALYTICS_EVENTS.MANTECA_KYC_ABANDONED : ANALYTICS_EVENTS.KYC_ABANDONED,
            { region_intent: regionIntent, phase: modalPhase }
        )
        isRealtimeFlowRef.current = false
        setForceShowModal(false)
        clearPreparingTimer()
        stopTracking()
        closeVerificationProgressModal()
    }, [clearPreparingTimer, stopTracking, closeVerificationProgressModal, regionIntent, modalPhase])

    // cleanup on unmount
    useEffect(() => {
        return () => {
            clearPreparingTimer()
            stopTracking()
        }
    }, [clearPreparingTimer, stopTracking])

    const isModalOpen = isVerificationProgressModalOpen || forceShowModal

    // multi-level only for first-time LATAM (workflow with conditional questionnaire).
    // cross-region LATAM uses an applicant action (single level, not multi-level).
    const isMultiLevel = regionIntent === 'LATAM' && !isActionFlow

    // Derive preparing stage from elapsed time for progressive copy
    const preparingStage = useMemo<'initial' | 'configuring' | 'slow'>(() => {
        if (preparingElapsed < 3) return 'initial'
        if (preparingElapsed < 8) return 'configuring'
        return 'slow'
    }, [preparingElapsed])

    return {
        // initiation
        handleInitiateKyc,
        handleSelfHealResubmit,
        isLoading,
        error,
        liveKycStatus,

        // SDK wrapper
        showWrapper,
        accessToken,
        handleSdkClose: handleClose,
        handleSdkComplete,
        refreshToken,
        isMultiLevel,

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
        preparingStage,

        // ToS iframe
        tosLink,
        showTosIframe,
        handleTosIframeClose,
    }
}
