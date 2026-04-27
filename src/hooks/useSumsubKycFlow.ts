import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useWebSocket } from '@/hooks/useWebSocket'
import { useUserStore } from '@/redux/hooks'
import { initiateSumsubKyc, initiateSelfHealResubmission } from '@/app/actions/sumsub'
import { type KYCRegionIntent, type SumsubKycStatus } from '@/app/actions/types/sumsub.types'

interface UseSumsubKycFlowOptions {
    onKycSuccess?: () => void
    onManualClose?: () => void
    regionIntent?: KYCRegionIntent
}

export const useSumsubKycFlow = ({ onKycSuccess, onManualClose, regionIntent }: UseSumsubKycFlowOptions = {}) => {
    const { user } = useUserStore()
    const router = useRouter()

    const [accessToken, setAccessToken] = useState<string | null>(null)
    const [showWrapper, setShowWrapper] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [isVerificationProgressModalOpen, setIsVerificationProgressModalOpen] = useState(false)
    const [liveKycStatus, setLiveKycStatus] = useState<SumsubKycStatus | undefined>(undefined)
    const [rejectLabels, setRejectLabels] = useState<string[] | undefined>(undefined)
    // true when the SDK is showing an applicant action (not a standard level)
    const [isActionFlow, setIsActionFlow] = useState(false)
    const prevStatusRef = useRef(liveKycStatus)
    const showWrapperRef = useRef(showWrapper)
    showWrapperRef.current = showWrapper
    // tracks the effective region intent across initiate + refresh so the correct template is always used
    const regionIntentRef = useRef<KYCRegionIntent | undefined>(regionIntent)
    // tracks the level name across initiate + refresh (e.g. 'peanut-additional-docs')
    const levelNameRef = useRef<string | undefined>(undefined)
    // guards fetchCurrentStatus from running while handleInitiateKyc is in progress
    const initiatingRef = useRef(false)
    // guard: only fire onKycSuccess when the user initiated a kyc flow in this session.
    // prevents stale websocket events or mount-time fetches from auto-closing the drawer.
    const userInitiatedRef = useRef(false)
    // tracks self-heal provider for token refresh — null when in regular KYC flow
    const selfHealProviderRef = useRef<'BRIDGE' | 'MANTECA' | null>(null)

    useEffect(() => {
        regionIntentRef.current = regionIntent
    }, [regionIntent])

    // listen for sumsub kyc status updates via websocket
    useWebSocket({
        username: user?.user.username ?? undefined,
        autoConnect: true,
        onSumsubKycStatusUpdate: (newStatus, newRejectLabels) => {
            setLiveKycStatus(newStatus as SumsubKycStatus)
            if (newRejectLabels) setRejectLabels(newRejectLabels)
        },
    })

    // react to status transitions
    useEffect(() => {
        const prevStatus = prevStatusRef.current
        prevStatusRef.current = liveKycStatus

        if (prevStatus !== 'APPROVED' && liveKycStatus === 'APPROVED') {
            // if SDK is still open (LATAM multi-level), close it now —
            // applicantWorkflowCompleted has fired, all levels are done.
            if (showWrapperRef.current) {
                setShowWrapper(false)
                setIsVerificationProgressModalOpen(true)
                userInitiatedRef.current = true
            }
            if (userInitiatedRef.current) {
                onKycSuccess?.()
            }
        } else if (
            liveKycStatus &&
            liveKycStatus !== prevStatus &&
            liveKycStatus !== 'APPROVED' &&
            liveKycStatus !== 'PENDING' &&
            liveKycStatus !== 'REVERIFYING'
        ) {
            // close modal for any non-success terminal state (REJECTED, ACTION_REQUIRED, FAILED, etc.)
            setIsVerificationProgressModalOpen(false)
        }
    }, [liveKycStatus, onKycSuccess])

    // fetch current status to recover from missed websocket events.
    // skip when regionIntent is undefined to avoid creating an applicant with the wrong template
    // (e.g. RegionsVerification mounts with no region selected yet).
    useEffect(() => {
        if (!regionIntent) return
        // skip if handleInitiateKyc is already in progress — it handles status sync itself
        if (initiatingRef.current) return

        const fetchCurrentStatus = async () => {
            try {
                const response = await initiateSumsubKyc({ regionIntent })
                if (response.data?.status && !initiatingRef.current) {
                    setLiveKycStatus(response.data.status)
                }
            } catch {
                // silent failure - we just show the user an error when they try to initiate the kyc flow if the api call is failing
            }
        }

        fetchCurrentStatus()
    }, [regionIntent])

    // polling fallback for missed websocket events.
    // when the verification progress modal is open, poll status every 5s
    // so the flow can transition even if the websocket event never arrives.
    useEffect(() => {
        if (!isVerificationProgressModalOpen) return

        const pollStatus = async () => {
            try {
                const response = await initiateSumsubKyc({
                    regionIntent: regionIntentRef.current,
                    levelName: levelNameRef.current,
                })
                if (response.data?.status) {
                    setLiveKycStatus(response.data.status)
                }
            } catch {
                // silent — polling is a best-effort fallback
            }
        }

        const interval = setInterval(pollStatus, 5000)
        return () => clearInterval(interval)
    }, [isVerificationProgressModalOpen])

    const handleInitiateKyc = useCallback(
        async (overrideIntent?: KYCRegionIntent, levelName?: string, crossRegion?: boolean) => {
            userInitiatedRef.current = true
            initiatingRef.current = true
            selfHealProviderRef.current = null
            setIsLoading(true)
            setError(null)

            // for cross-region: pre-set prevStatusRef to APPROVED so the fetchCurrentStatus
            // effect (which also fires when regionIntent changes) doesn't trigger onKycSuccess
            // when it sees the existing APPROVED status.
            if (crossRegion) {
                prevStatusRef.current = 'APPROVED'
            }

            try {
                const response = await initiateSumsubKyc({
                    regionIntent: overrideIntent ?? regionIntent,
                    levelName,
                    crossRegion,
                })

                if (response.error) {
                    setError(response.error)
                    return
                }

                // sync status from api response, but skip when a token is returned
                // alongside APPROVED — that means the SDK should open (e.g. additional-docs flow),
                // not that kyc is finished. syncing APPROVED here would trigger the useEffect
                // which fires onKycSuccess and closes everything before the SDK opens.
                if (response.data?.status && !(response.data.status === 'APPROVED' && response.data.token)) {
                    setLiveKycStatus(response.data.status)
                }

                // update effective intent + level for token refresh
                const effectiveIntent = overrideIntent ?? regionIntent
                if (effectiveIntent) regionIntentRef.current = effectiveIntent
                levelNameRef.current = levelName

                // cross-region: bridge-direct means no SDK needed — backend is handling
                // rail enrollment + submission. go straight to the post-approval flow.
                if (response.data?.actionType === 'bridge-direct') {
                    prevStatusRef.current = 'APPROVED'
                    userInitiatedRef.current = true
                    setIsActionFlow(false)
                    setIsVerificationProgressModalOpen(true)
                    onKycSuccess?.()
                    return
                }

                // if already approved (or reverifying) and no token returned, kyc is done.
                // set prevStatusRef so the transition effect doesn't fire onKycSuccess a second time.
                // when a token IS returned (e.g. cross-region action or additional-docs), we still need to show the SDK.
                const status = response.data?.status
                if ((status === 'APPROVED' || status === 'REVERIFYING') && !response.data?.token) {
                    prevStatusRef.current = status
                    onKycSuccess?.()
                    return
                }

                if (response.data?.token) {
                    setAccessToken(response.data.token)
                    setIsActionFlow(!!response.data.actionType)
                    setShowWrapper(true)
                } else {
                    setError('Could not initiate verification. Please try again.')
                }
            } catch (e: unknown) {
                const message = e instanceof Error ? e.message : 'An unexpected error occurred'
                setError(message)
            } finally {
                setIsLoading(false)
                initiatingRef.current = false
            }
        },
        [regionIntent, onKycSuccess]
    )

    // called when sdk signals applicant submitted
    const handleSdkComplete = useCallback(() => {
        userInitiatedRef.current = true
        setShowWrapper(false)
        setIsActionFlow(false)
        setIsVerificationProgressModalOpen(true)
    }, [])

    // called when user manually closes the sdk modal
    const handleClose = useCallback(() => {
        setShowWrapper(false)
        setIsActionFlow(false)
        onManualClose?.()
    }, [onManualClose])

    // token refresh function passed to the sdk for when the token expires.
    // uses self-heal provider ref when in self-heal mode, otherwise regular KYC endpoint.
    const refreshToken = useCallback(async (): Promise<string> => {
        if (selfHealProviderRef.current) {
            const response = await initiateSelfHealResubmission(selfHealProviderRef.current)
            if (response.error || !response.data?.token) {
                throw new Error(response.error || 'Failed to refresh self-heal token')
            }
            setAccessToken(response.data.token)
            return response.data.token
        }

        const response = await initiateSumsubKyc({
            regionIntent: regionIntentRef.current,
            levelName: levelNameRef.current,
        })

        if (response.error || !response.data?.token) {
            throw new Error(response.error || 'Failed to refresh token')
        }

        setAccessToken(response.data.token)
        return response.data.token
    }, [])

    const closeVerificationProgressModal = useCallback(() => {
        setIsVerificationProgressModalOpen(false)
    }, [])

    const closeVerificationModalAndGoHome = useCallback(() => {
        setIsVerificationProgressModalOpen(false)
        router.push('/home')
    }, [router])

    const resetError = useCallback(() => {
        setError(null)
    }, [])

    // initiate self-heal document resubmission: calls the resubmit API
    // and opens the sumsub SDK with the action token
    const handleSelfHealResubmit = useCallback(async (provider: 'BRIDGE' | 'MANTECA') => {
        setIsLoading(true)
        setError(null)
        userInitiatedRef.current = true
        selfHealProviderRef.current = provider

        try {
            const response = await initiateSelfHealResubmission(provider)

            if (response.error) {
                selfHealProviderRef.current = null
                setError(response.error)
                return
            }

            if (response.data?.token) {
                setAccessToken(response.data.token)
                setShowWrapper(true)
            } else {
                selfHealProviderRef.current = null
                setError('Could not initiate document resubmission. Please try again.')
            }
        } catch (e: unknown) {
            selfHealProviderRef.current = null
            const message = e instanceof Error ? e.message : 'An unexpected error occurred'
            setError(message)
        } finally {
            setIsLoading(false)
        }
    }, [])

    return {
        isLoading,
        error,
        showWrapper,
        accessToken,
        liveKycStatus,
        rejectLabels,
        handleInitiateKyc,
        handleSelfHealResubmit,
        handleSdkComplete,
        handleClose,
        refreshToken,
        isVerificationProgressModalOpen,
        closeVerificationProgressModal,
        closeVerificationModalAndGoHome,
        resetError,
        isActionFlow,
    }
}
