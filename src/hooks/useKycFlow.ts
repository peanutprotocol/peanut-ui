import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { IFrameWrapperProps } from '@/components/Global/IframeWrapper'
import { useWebSocket } from '@/hooks/useWebSocket'
import { useUserStore } from '@/redux/hooks'
import { KYCStatus, convertPersonaUrl } from '@/utils'
import { InitiateKycResponse } from '@/app/actions/types/users.types'
import { getKycDetails } from '@/app/actions/users'

// persona event detail types
interface PersonaEventDetail {
    inquiryId: string
    status: string
    sessionToken?: string
}

interface PersonaEvent extends Event {
    detail: PersonaEventDetail
}

interface UseKycFlowOptions {
    onKycSuccess?: () => void
    flow?: 'add' | 'withdraw'
}

export type KycHistoryEntry = {
    isKyc: true
    uuid: string
    timestamp: string
}

// type guard to check if an entry is a KYC status item in history section
export const isKycStatusItem = (entry: object): entry is KycHistoryEntry => {
    return 'isKyc' in entry && entry.isKyc === true
}

export const useKycFlow = ({ onKycSuccess, flow }: UseKycFlowOptions = {}) => {
    const { user } = useUserStore()
    const router = useRouter()
    const isMounted = useRef(false)

    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [apiResponse, setApiResponse] = useState<InitiateKycResponse | null>(null)
    const [liveKycStatus, setLiveKycStatus] = useState<KYCStatus | undefined>(user?.user?.kycStatus as KYCStatus)

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
            setLiveKycStatus(newStatus as KYCStatus)
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
        if (isMounted.current) {
            if (liveKycStatus === 'approved') {
                setIsVerificationProgressModalOpen(false)
                onKycSuccess?.()
            } else if (liveKycStatus === 'rejected') {
                setIsVerificationProgressModalOpen(false)
            }
        } else {
            isMounted.current = true
        }
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
                    const errorMsg = 'Could not retrieve verification links. Please try again.'
                    setError(errorMsg)
                    return { success: false, error: errorMsg }
                }
                return { success: true }
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

            // hide the iframe
            setIframeOptions({ src: '', visible: false, closeConfirmMessage: undefined })

            // if we just closed the tos link after it was accepted, open the kyc link next.
            if (wasShowingTos && source === 'tos_accepted' && apiResponse?.kycLink) {
                const kycUrl = convertPersonaUrl(apiResponse.kycLink)
                // short delay to allow the iframe to properly close before re-opening
                setTimeout(() => {
                    setIframeOptions({
                        src: kycUrl,
                        visible: true,
                        closeConfirmMessage: 'Are you sure? Your KYC progress will be lost.',
                    })
                }, 100)
            } else if (source === 'completed') {
                // if we just closed the kyc link after completion, open the "in progress" modal.
                setIsVerificationProgressModalOpen(true)
            } else if (source === 'manual' && flow === 'add') {
                router.push('/add-money')
            }
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
