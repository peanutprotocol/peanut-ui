import { KYCStatus } from '@/utils'
import { useToast } from '@chakra-ui/react'
import { useEffect, useState } from 'react'
import Modal from '../Modal'
import { fetchWithSentry } from '@/utils'

export type IFrameWrapperProps = {
    src: string
    visible: boolean
    onClose: () => void
    closeConfirmMessage?: string
    onKycComplete?: () => void
    customerId?: string
}

const IframeWrapper = ({
    src,
    visible,
    onClose,
    closeConfirmMessage,
    onKycComplete,
    customerId,
}: IFrameWrapperProps) => {
    const enableConfirmationPrompt = closeConfirmMessage !== undefined
    const [showCloseConfirmMessage, setShowCloseConfirmMessage] = useState(false)
    const [isPolling, setIsPolling] = useState(false)
    const toast = useToast()

    // Reset showCloseConfirmMessage when visibility changes or src changes
    useEffect(() => {
        if (!visible || src === '') {
            setShowCloseConfirmMessage(false)
        }
    }, [visible, src])

    // track completed event from iframe and close the modal
    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            if (event.data?.name === 'complete' && event.data?.metadata?.status === 'completed') {
                onClose()
            }
        }

        window.addEventListener('message', handleMessage)
        return () => window.removeEventListener('message', handleMessage)
    }, [onClose])

    useEffect(() => {
        if (!visible || !customerId) return

        const pollKycStatus = async () => {
            try {
                console.log('🔍 Polling KYC status for customer:', customerId)
                const response = await fetchWithSentry(`/api/bridge/user/new/get-status`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        userId: customerId,
                        type: 'kyc',
                    }),
                })

                if (!response.ok) return

                const data = await response.json()
                const kycStatus: KYCStatus = data.kyc_status
                console.log('📊 Current KYC status:', kycStatus)

                if (kycStatus === 'not_started') {
                    return // Continue polling without changing isPolling state
                }

                if (kycStatus === 'approved') {
                    setIsPolling(false)
                    toast({
                        title: 'Success',
                        description: 'KYC completed successfully!',
                        status: 'success',
                        duration: 5000,
                        isClosable: true,
                    })
                    onKycComplete?.()
                    onClose()
                } else if (kycStatus === 'rejected') {
                    setIsPolling(false)
                    toast({
                        title: 'KYC Rejected',
                        description: 'Please contact support.',
                        status: 'error',
                        duration: 5000,
                        isClosable: true,
                    })
                    onClose()
                } else if (kycStatus === 'under_review') {
                    setIsPolling(false)
                    toast({
                        title: 'Under Review',
                        description: 'Your KYC is under review. Our team will process it shortly.',
                        status: 'info',
                        duration: 5000,
                        isClosable: true,
                    })
                    onClose()
                }
            } catch (error) {
                console.error('❌ Error polling KYC status:', error)
                setIsPolling(false)
            }
        }

        let pollInterval: NodeJS.Timeout

        if (visible && !isPolling) {
            console.log('🔄 Starting KYC status polling...')
            setIsPolling(true)
            // Initial check
            pollKycStatus()
            // Then poll every 1.5 seconds
            pollInterval = setInterval(pollKycStatus, 1500)
        }

        return () => {
            if (pollInterval) {
                console.log('🛑 Stopping KYC status polling')
                clearInterval(pollInterval)
            }
        }
    }, [visible, customerId, onKycComplete, onClose, isPolling, toast])

    return (
        <Modal
            visible={visible}
            onClose={() => {
                if (!enableConfirmationPrompt) {
                    onClose()
                    return
                }
                if (src.includes('tos')) {
                    onClose()
                    return
                }
                setShowCloseConfirmMessage(true)
            }}
            classWrap="h-[85%] sm:h-full w-full !max-w-none sm:!max-w-[600px] border-none sm:m-auto m-0"
            classOverlay="bg-black bg-opacity-50"
            video={false}
            className="z-[1000001] !p-0 md:!p-6"
            classButtonClose="hidden"
            hideOverlay={false}
        >
            <div className="flex h-full flex-col gap-2 p-0">
                <div className="w-full flex-shrink-0">
                    {enableConfirmationPrompt && showCloseConfirmMessage ? (
                        <div className="flex w-full flex-col justify-between gap-3 border-b border-n-1 p-4 md:h-14 md:flex-row md:items-center">
                            <p className="text-sm">{closeConfirmMessage}</p>
                            <div className="flex flex-row items-center gap-2">
                                <button
                                    className="btn-stroke h-10"
                                    onClick={() => {
                                        setShowCloseConfirmMessage(false)
                                    }}
                                >
                                    Cancel
                                </button>
                                <button
                                    className="btn-purple h-10"
                                    onClick={() => {
                                        onClose()
                                        setShowCloseConfirmMessage(false)
                                    }}
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    ) : (
                        <button
                            className="btn-purple h-14 w-full rounded-none border-b border-n-1"
                            onClick={() => {
                                setShowCloseConfirmMessage(true)
                            }}
                        >
                            CLOSE
                        </button>
                    )}
                </div>
                <div className="h-full w-full flex-grow overflow-scroll">
                    <iframe
                        src={src}
                        allow="camera;"
                        style={{ width: '100%', height: '100%', border: 'none' }}
                        className="rounded-md"
                        sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals allow-top-navigation-by-user-activation"
                    />
                </div>
            </div>
        </Modal>
    )
}

export default IframeWrapper
