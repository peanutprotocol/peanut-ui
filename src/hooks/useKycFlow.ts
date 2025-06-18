import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { IFrameWrapperProps } from '@/components/Global/IframeWrapper'
import { useWebSocket } from '@/hooks/useWebSocket'
import { useUserStore } from '@/redux/hooks'
import { KYCStatus, convertPersonaUrl } from '@/utils'
import { InitiateKycResponse } from '@/app/actions/types/users.types'
import { initiateKyc } from '@/app/actions/users'

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
}

export const useKycFlow = ({ onKycSuccess }: UseKycFlowOptions = {}) => {
    const { user } = useUserStore()
    const router = useRouter()

    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [apiResponse, setApiResponse] = useState<InitiateKycResponse | null>(null)
    const [liveKycStatus, setLiveKycStatus] = useState<KYCStatus | undefined>(user?.user?.kycStatus as KYCStatus)

    const [iframeOptions, setIframeOptions] = useState<Omit<IFrameWrapperProps, 'onClose'>>({
        src: '',
        visible: false,
        closeConfirmMessage: undefined,
    })
    const [isVerificationModalOpen, setIsVerificationModalOpen] = useState(false)

    // listen for websocket updates
    useWebSocket({
        username: user?.user.username ?? undefined,
        autoConnect: true,
        onKycStatusUpdate: (newStatus) => {
            setLiveKycStatus(newStatus as KYCStatus)
        },
    })

    // listen for persona events
    useEffect(() => {
        const handlePersonaEvent = (event: Event) => {
            const personaEvent = event as PersonaEvent
            if (!personaEvent.detail) return

            // the 'complete' event is fired for both TOS and KYC flows.
            // when TOS is done, we need to show the KYC link.
            // when KYC is done, we show the verification modal.
            if (personaEvent.detail.status === 'completed') {
                handleIframeClose()
            }
        }

        window.addEventListener('persona:complete', handlePersonaEvent)
        window.addEventListener('persona:next', handlePersonaEvent) // Fallback for some flows

        return () => {
            window.removeEventListener('persona:complete', handlePersonaEvent)
            window.removeEventListener('persona:next', handlePersonaEvent)
        }
    }, [apiResponse]) // rerun when apiResponse changes to have the correct context in handleIframeClose

    // when the final status is received, close the verification modal
    useEffect(() => {
        if (liveKycStatus === 'approved') {
            setIsVerificationModalOpen(false)
            onKycSuccess?.()
        } else if (liveKycStatus === 'rejected') {
            setIsVerificationModalOpen(false)
        }
    }, [liveKycStatus, onKycSuccess])

    const handleInitiateKyc = async () => {
        setIsLoading(true)
        setError(null)
        try {
            const response = await initiateKyc()
            setApiResponse(response)

            // if there's a tos link, show it first. otherwise, go straight to kyc.
            if (response.tosLink) {
                setIframeOptions({ src: response.tosLink, visible: true })
            } else if (response.kycLink) {
                const kycUrl = convertPersonaUrl(response.kycLink)
                setIframeOptions({
                    src: kycUrl,
                    visible: true,
                    closeConfirmMessage: 'Are you sure? Your KYC progress will be lost.',
                })
            } else {
                setError('Could not retrieve verification links. Please try again.')
            }
        } catch (e: any) {
            setError(e.message || 'An unknown error occurred.')
        } finally {
            setIsLoading(false)
        }
    }

    const handleIframeClose = () => {
        const wasShowingTos = iframeOptions.src === apiResponse?.tosLink

        // hide the iframe
        setIframeOptions({ src: '', visible: false, closeConfirmMessage: undefined })

        // if we just closed the tos link, open the kyc link next.
        if (wasShowingTos && apiResponse?.kycLink) {
            const kycUrl = convertPersonaUrl(apiResponse.kycLink)
            // short delay to allow the iframe to properly close before re-opening
            setTimeout(() => {
                setIframeOptions({
                    src: kycUrl,
                    visible: true,
                    closeConfirmMessage: 'Are you sure? Your KYC progress will be lost.',
                })
            }, 100)
        } else {
            // if we just closed the kyc link, open the "in progress" modal.
            setIsVerificationModalOpen(true)
        }
    }

    const closeVerificationModal = () => {
        setIsVerificationModalOpen(false)
    }

    const closeVerificationModalAndGoHome = () => {
        setIsVerificationModalOpen(false)
        router.push('/home')
    }

    return {
        isLoading,
        error,
        iframeOptions,
        isVerificationModalOpen,
        handleInitiateKyc,
        handleIframeClose,
        closeVerificationModal,
        closeVerificationModalAndGoHome,
    }
}
