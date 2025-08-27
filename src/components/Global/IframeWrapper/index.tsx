import { useEffect, useMemo, useState } from 'react'
import Modal from '../Modal'
import { Button, ButtonVariant } from '@/components/0_Bruddle'
import { Icon, IconName } from '../Icons/Icon'
import ActionModal from '../ActionModal'
import { useRouter } from 'next/navigation'
import StartVerificationView from './StartVerificationView'

export type IFrameWrapperProps = {
    src: string
    visible: boolean
    onClose: (source?: 'manual' | 'completed' | 'tos_accepted') => void
    closeConfirmMessage?: string
}

const IframeWrapper = ({ src, visible, onClose, closeConfirmMessage }: IFrameWrapperProps) => {
    const enableConfirmationPrompt = closeConfirmMessage !== undefined
    const [showCloseConfirmMessage, setShowCloseConfirmMessage] = useState(false)
    const [isHelpModalOpen, setIsHelpModalOpen] = useState(false)
    const [modalVariant, setModalVariant] = useState<'stop-verification' | 'trouble'>('trouble')
    const [copied, setCopied] = useState(false)
    const [isVerificationStarted, setIsVerificationStarted] = useState(false)
    const router = useRouter()

    const handleCopy = (textToCopy: string) => {
        navigator.clipboard.writeText(textToCopy).then(() => {
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        })
    }

    const modalDetails = useMemo(() => {
        if (modalVariant === 'trouble') {
            return {
                title: 'Having trouble verifying?',
                description:
                    'If the verification isn’t loading here, you can finish it in your browser. Just copy this link and open it there.',
                icon: 'info' as IconName,
                iconContainerClassName: 'bg-primary-1',
                ctas: [
                    {
                        text: 'Copy link',
                        icon: copied ? 'check' : ('copy' as IconName),
                        onClick: () => {
                            handleCopy(src)
                        },
                        variant: 'purple' as ButtonVariant,
                        shadowSize: '4' as const,
                    },
                    {
                        text: 'Chat with support',
                        icon: 'peanut-support' as IconName,
                        onClick: () => router.push('/support'),
                        variant: 'transparent' as ButtonVariant,
                        className: 'underline text-sm font-medium w-full fill-none',
                    },
                ],
            }
        }

        return {
            title: 'Stop verification?',
            description: 'If you exit now, your verification won’t be completed and you’ll need to start again later.',
            icon: 'info' as IconName,
            iconContainerClassName: 'bg-secondary-1',
            ctas: [
                {
                    text: 'Stop verification',
                    onClick: () => {
                        setIsHelpModalOpen(false)
                        onClose('manual')
                    },
                    variant: 'purple' as ButtonVariant,
                    shadowSize: '4' as const,
                },
                {
                    text: 'Continue verifying',
                    onClick: () => setIsHelpModalOpen(false),
                    variant: 'transparent' as ButtonVariant,
                    className: 'underline text-sm font-medium w-full',
                },
            ],
        }
    }, [modalVariant, copied])

    // Reset showCloseConfirmMessage when visibility changes or src changes
    useEffect(() => {
        if (!visible || src === '') {
            setShowCloseConfirmMessage(false)
        }
    }, [visible, src])

    // track completed event from iframe and close the modal
    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            const data = event.data
            if (data?.name === 'complete' && data?.metadata?.status === 'completed') {
                onClose('completed')
            }
            // @dev note: kinda hacky, but tos modal takes too long to close using websocket, so we use the signedAgreementId to close it
            // persona fires this event when the user clicks the "accept" button within the iframe
            if (data?.signedAgreementId) {
                onClose('tos_accepted')
            }
        }

        window.addEventListener('message', handleMessage)
        return () => window.removeEventListener('message', handleMessage)
    }, [onClose])

    return (
        <Modal
            visible={visible}
            onClose={() => {
                if (!enableConfirmationPrompt) {
                    onClose('manual')
                    return
                }
                if (src.includes('tos')) {
                    onClose('manual')
                    return
                }
                setShowCloseConfirmMessage(true)
            }}
            classWrap="h-full w-full !max-w-none sm:!max-w-[600px] border-none sm:m-auto m-0"
            classOverlay={`bg-black bg-opacity-50 ${isHelpModalOpen ? 'pointer-events-none' : ''}`}
            video={false}
            className={`z-[100] !p-0 md:!p-6 ${isHelpModalOpen ? 'pointer-events-none' : ''}`}
            classButtonClose="hidden"
            preventClose={true}
            hideOverlay={false}
        >
            {!isVerificationStarted ? (
                <StartVerificationView onStartVerification={() => setIsVerificationStarted(true)} />
            ) : (
                <div className="flex h-full flex-col gap-2 p-0">
                    <div className="w-full flex-shrink-0">
                        {showCloseConfirmMessage ? (
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
                                            onClose('manual')
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
                                    // only show confirmation for kyc step, otherwise close immediately
                                    if (enableConfirmationPrompt && !src.includes('tos')) {
                                        setShowCloseConfirmMessage(true)
                                    } else {
                                        onClose('manual')
                                    }
                                }}
                            >
                                CLOSE
                            </button>
                        )}
                    </div>
                    <div className="h-full w-full flex-grow overflow-scroll">
                        <iframe
                            key={src}
                            src={src}
                            allow="camera;"
                            style={{ width: '100%', height: '80%', border: 'none' }}
                            className="rounded-md"
                            sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals allow-top-navigation-by-user-activation"
                        />
                        <div className="flex h-1/5 w-full flex-col items-center justify-center gap-4 px-5">
                            <Button
                                variant={'purple'}
                                className={`max-w-md`}
                                onClick={() => {
                                    setModalVariant('stop-verification')
                                    setIsHelpModalOpen(true)
                                }}
                                shadowType="primary"
                                shadowSize="4"
                            >
                                Stop verification process
                            </Button>

                            <button
                                onClick={() => {
                                    setModalVariant('trouble')
                                    setIsHelpModalOpen(true)
                                }}
                                className="flex items-center gap-1"
                            >
                                <Icon name="peanut-support" size={16} />
                                <p className="text-xs font-medium underline">Having trouble?</p>
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* {isHelpModalOpen && ( */}
            <ActionModal
                visible={isHelpModalOpen}
                onClose={() => setIsHelpModalOpen(false)}
                title={modalDetails.title}
                description={modalDetails.description}
                icon={modalDetails.icon}
                iconContainerClassName={modalDetails.iconContainerClassName}
                modalPanelClassName="max-w-full pointer-events-auto"
                ctaClassName="grid grid-cols-1 gap-3"
                modalClassName="!z-[10001] pointer-events-auto"
                preventClose={true}
                ctas={modalDetails.ctas}
            />
            {/* )} */}
        </Modal>
    )
}

export default IframeWrapper
