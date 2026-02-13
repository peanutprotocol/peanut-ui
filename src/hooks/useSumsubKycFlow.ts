import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useWebSocket } from '@/hooks/useWebSocket'
import { useUserStore } from '@/redux/hooks'
import { initiateSumsubKyc } from '@/app/actions/sumsub'
import { type SumsubKycStatus } from '@/app/actions/types/sumsub.types'

interface UseSumsubKycFlowOptions {
    onKycSuccess?: () => void
    onManualClose?: () => void
    regionIntent?: string
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
            setIsVerificationProgressModalOpen(false)
            onKycSuccess?.()
        } else if (prevStatus !== 'REJECTED' && liveKycStatus === 'REJECTED') {
            setIsVerificationProgressModalOpen(false)
        }
    }, [liveKycStatus, onKycSuccess])

    // fetch current status on mount to recover from missed websocket events
    useEffect(() => {
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
    }, [])

    const handleInitiateKyc = useCallback(async () => {
        setIsLoading(true)
        setError(null)

        try {
            const response = await initiateSumsubKyc({ regionIntent })

            if (response.error) {
                setError(response.error)
                return
            }

            // sync status from api response
            if (response.data?.status) {
                setLiveKycStatus(response.data.status)
            }

            // if already approved, no token is returned
            if (response.data?.status === 'APPROVED') {
                onKycSuccess?.()
                return
            }

            if (response.data?.token) {
                setAccessToken(response.data.token)
                setShowWrapper(true)
            } else {
                setError('Could not initate verification. Please try again.')
            }
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : 'An unexpected error occurred'
            setError(message)
        } finally {
            setIsLoading(false)
        }
    }, [regionIntent, onKycSuccess])

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

    // token refresh function passed to the sdk for when the token expires
    const refreshToken = useCallback(async (): Promise<string> => {
        const response = await initiateSumsubKyc({ regionIntent })

        if (response.error || !response.data?.token) {
            throw new Error(response.error || 'Failed to refresh token')
        }

        setAccessToken(response.data.token)
        return response.data.token
    }, [regionIntent])

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
