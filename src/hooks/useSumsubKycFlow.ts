import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useWebSocket } from '@/hooks/useWebSocket'
import { useUserStore } from '@/redux/hooks'
import { initiateSumsubKyc } from '@/app/actions/sumsub'
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
    const prevStatusRef = useRef(liveKycStatus)
    // tracks the effective region intent across initiate + refresh so the correct template is always used
    const regionIntentRef = useRef<KYCRegionIntent | undefined>(regionIntent)

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
            onKycSuccess?.()
        } else if (
            liveKycStatus &&
            liveKycStatus !== prevStatus &&
            liveKycStatus !== 'APPROVED' &&
            liveKycStatus !== 'PENDING'
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

        const fetchCurrentStatus = async () => {
            try {
                const response = await initiateSumsubKyc({ regionIntent })
                if (response.data?.status) {
                    setLiveKycStatus(response.data.status)
                }
            } catch {
                // silent failure - we just show the user an error when they try to initiate the kyc flow if the api call is failing
            }
        }

        fetchCurrentStatus()
    }, [regionIntent])

    const handleInitiateKyc = useCallback(
        async (overrideIntent?: KYCRegionIntent) => {
            setIsLoading(true)
            setError(null)

            try {
                const response = await initiateSumsubKyc({ regionIntent: overrideIntent ?? regionIntent })

                if (response.error) {
                    setError(response.error)
                    return
                }

                // sync status from api response
                if (response.data?.status) {
                    setLiveKycStatus(response.data.status)
                }

                // update effective intent for token refresh
                const effectiveIntent = overrideIntent ?? regionIntent
                if (effectiveIntent) regionIntentRef.current = effectiveIntent

                // if already approved, no token is returned.
                // set prevStatusRef so the transition effect doesn't fire onKycSuccess a second time.
                if (response.data?.status === 'APPROVED') {
                    prevStatusRef.current = 'APPROVED'
                    onKycSuccess?.()
                    return
                }

                if (response.data?.token) {
                    setAccessToken(response.data.token)
                    setShowWrapper(true)
                } else {
                    setError('Could not initiate verification. Please try again.')
                }
            } catch (e: unknown) {
                const message = e instanceof Error ? e.message : 'An unexpected error occurred'
                setError(message)
            } finally {
                setIsLoading(false)
            }
        },
        [regionIntent, onKycSuccess]
    )

    // called when sdk signals applicant submitted
    const handleSdkComplete = useCallback(() => {
        setShowWrapper(false)
        setIsVerificationProgressModalOpen(true)
    }, [])

    // called when user manually closes the sdk modal
    const handleClose = useCallback(() => {
        setShowWrapper(false)
        onManualClose?.()
    }, [onManualClose])

    // token refresh function passed to the sdk for when the token expires.
    // uses regionIntentRef so refresh always matches the template used during initiation.
    const refreshToken = useCallback(async (): Promise<string> => {
        const response = await initiateSumsubKyc({ regionIntent: regionIntentRef.current })

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

    return {
        isLoading,
        error,
        showWrapper,
        accessToken,
        liveKycStatus,
        rejectLabels,
        handleInitiateKyc,
        handleSdkComplete,
        handleClose,
        refreshToken,
        isVerificationProgressModalOpen,
        closeVerificationProgressModal,
        closeVerificationModalAndGoHome,
        resetError,
    }
}
