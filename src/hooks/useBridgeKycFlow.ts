import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { IFrameWrapperProps } from '@/components/Global/IframeWrapper'
import { useWebSocket } from '@/hooks/useWebSocket'
import { useUserStore } from '@/redux/hooks'
import { BridgeKycStatus, convertPersonaUrl } from '@/utils'
import { InitiateKycResponse } from '@/app/actions/types/users.types'
import { getKycDetails, updateUserById } from '@/app/actions/users'
import { IUserKycVerification } from '@/interfaces'

interface UseKycFlowOptions {
    onKycSuccess?: () => void
    flow?: 'add' | 'withdraw' | 'request_fulfillment'
    onManualClose?: () => void
}

export interface KycHistoryEntry {
    isKyc: true
    uuid: string
    timestamp: string
    verification?: IUserKycVerification
    bridgeKycStatus?: BridgeKycStatus
}

// type guard to check if an entry is a KYC status item in history section
export const isKycStatusItem = (entry: object): entry is KycHistoryEntry => {
    return 'isKyc' in entry && entry.isKyc === true
}

export const useBridgeKycFlow = ({ onKycSuccess, flow, onManualClose }: UseKycFlowOptions = {}) => {
    const { user } = useUserStore()
    const router = useRouter()
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [apiResponse, setApiResponse] = useState<InitiateKycResponse | null>(null)
    const [liveKycStatus, setLiveKycStatus] = useState<BridgeKycStatus | undefined>(
        user?.user?.bridgeKycStatus as BridgeKycStatus
    )
    const prevStatusRef = useRef(liveKycStatus)

    const [iframeOptions, setIframeOptions] = useState<Omit<IFrameWrapperProps, 'onClose'>>({
        src: '',
        visible: false,
        closeConfirmMessage: undefined,
    })
    const [isVerificationProgressModalOpen, setIsVerificationProgressModalOpen] = useState(false)

    // listen for websocket updates
    useWebSocket({
        username: user?.user.username ?? undefined,
        autoConnect: true,
        onKycStatusUpdate: (newStatus) => {
            setLiveKycStatus(newStatus as BridgeKycStatus)
        },
        onTosUpdate: (data) => {
            if (data.accepted) {
                handleIframeClose('tos_accepted')
            }
        },
    })

    // when the final status is received, close the verification modal
    useEffect(() => {
        // We only want to run this effect on updates, not on the initial mount
        // to prevent `onKycSuccess` from being called when the component first renders
        // with an already-approved status.
        const prevStatus = prevStatusRef.current
        prevStatusRef.current = liveKycStatus
        if (prevStatus !== 'approved' && liveKycStatus === 'approved') {
            setIsVerificationProgressModalOpen(false)
            onKycSuccess?.()
        } else if (prevStatus !== 'rejected' && liveKycStatus === 'rejected') {
            setIsVerificationProgressModalOpen(false)
        }
        prevStatusRef.current = liveKycStatus
    }, [liveKycStatus, onKycSuccess])

    const handleInitiateKyc = async () => {
        setIsLoading(true)
        setError(null)

        try {
            const response = await getKycDetails()

            if (response.error) {
                setError(response.error)
                setIsLoading(false)
                return { success: false, error: response.error }
            }

            if (response.data) {
                setApiResponse(response.data)
                // if there's a tos link and it's not yet approved, show it first.
                if (response.data.tosLink && response.data.tosStatus !== 'approved') {
                    setIframeOptions({ src: response.data.tosLink, visible: true })
                } else if (response.data.kycLink) {
                    const kycUrl = convertPersonaUrl(response.data.kycLink)
                    setIframeOptions({
                        src: kycUrl,
                        visible: true,
                        closeConfirmMessage: 'Are you sure? Your KYC progress will be lost.',
                    })
                } else {
                    const errorMsg = 'Could not retrieve verification links. Please contact support.'
                    setError(errorMsg)
                    return { success: false, error: errorMsg }
                }
                return { success: true, data: response.data }
            }
        } catch (e: any) {
            setError(e.message)
            return { success: false, error: e.message }
        } finally {
            setIsLoading(false)
        }
    }

    const handleIframeClose = useCallback(
        (source: 'completed' | 'manual' | 'tos_accepted' = 'manual') => {
            const wasShowingTos = iframeOptions.src === apiResponse?.tosLink

            // handle tos acceptance: only act if the tos iframe is currently shown.
            if (source === 'tos_accepted') {
                if (wasShowingTos && apiResponse?.kycLink) {
                    const kycUrl = convertPersonaUrl(apiResponse.kycLink)
                    setIframeOptions({
                        src: kycUrl,
                        visible: true,
                        closeConfirmMessage: 'Are you sure? Your KYC progress will be lost.',
                    })
                }
                // ignore late ToS events when KYC is already open
                return
            }

            // When KYC signals completion, close iframe and show progress modal
            if (source === 'completed') {
                setIframeOptions((prev) => ({ ...prev, visible: false }))
                setIsVerificationProgressModalOpen(true)
                // set the status to under review explicitly to avoild delays from bridge webhook
                updateUserById({
                    userId: user?.user.userId,
                    bridgeKycStatus: 'under_review' as BridgeKycStatus,
                })
                return
            }

            // manual abort: close modal; optionally redirect in add flow
            if (source === 'manual') {
                setIframeOptions((prev) => ({ ...prev, visible: false }))
                if (flow === 'add') {
                    router.push('/add-money')
                } else if (flow === 'request_fulfillment') {
                    onManualClose?.()
                }
                return
            }

            // for any other sources, do nothing
        },
        [iframeOptions.src, apiResponse, flow, router]
    )

    const closeVerificationProgressModal = () => {
        setIsVerificationProgressModalOpen(false)
    }

    const closeVerificationModalAndGoHome = () => {
        setIsVerificationProgressModalOpen(false)
        router.push('/home')
    }

    return {
        isLoading,
        error,
        iframeOptions,
        isVerificationProgressModalOpen,
        handleInitiateKyc,
        handleIframeClose,
        closeVerificationProgressModal,
        closeVerificationModalAndGoHome,
    }
}
