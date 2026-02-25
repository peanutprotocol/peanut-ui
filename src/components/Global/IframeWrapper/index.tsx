import { useEffect, useMemo, useState } from 'react'
import Modal from '../Modal'
import { Icon, type IconName } from '../Icons/Icon'
import ActionModal from '../ActionModal'
import { useRouter } from 'next/navigation'
import StartVerificationView from './StartVerificationView'
import { useModalsContext } from '@/context/ModalsContext'
import { Button, type ButtonVariant } from '@/components/0_Bruddle/Button'

export type IFrameWrapperProps = {
    src: string
    visible: boolean
    onClose: (source?: 'manual' | 'completed' | 'tos_accepted') => void
    closeConfirmMessage?: string
    skipStartView?: boolean
}

const IframeWrapper = ({ src, visible, onClose, closeConfirmMessage, skipStartView }: IFrameWrapperProps) => {
    const enableConfirmationPrompt = closeConfirmMessage !== undefined
    const [isHelpModalOpen, setIsHelpModalOpen] = useState(false)
    const [modalVariant, setModalVariant] = useState<'stop-verification' | 'trouble'>('trouble')
    const [copied, setCopied] = useState(false)
    const [isVerificationStarted, setIsVerificationStarted] = useState(skipStartView ?? false)
    const router = useRouter()
    const { setIsSupportModalOpen } = useModalsContext()

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
                description: (
                    <p>
                        If the verification isn&apos;t loading here, you can finish it in your browser.
                        <br />
                        Just copy this link and open it there.
                    </p>
                ),
                icon: 'question-mark' as IconName,
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
                        onClick: () => setIsSupportModalOpen(true),
                        variant: 'transparent' as ButtonVariant,
                        className: 'underline text-sm font-medium w-full fill-none h-fit mt-3',
                    },
                ],
            }
        }

        return {
            title: 'Stop verification?',
            description: 'If you exit now, your verification won’t be completed and you’ll need to start again later.',
            icon: 'alert' as IconName,
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
                    className: 'underline text-sm font-medium w-full h-fit mt-3',
                },
            ],
        }
    }, [modalVariant, copied, src, router])

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
                <StartVerificationView
                    onClose={() => onClose('manual')}
                    onStartVerification={() => setIsVerificationStarted(true)}
                />
            ) : (
                <div className="flex h-full flex-col gap-2 p-0">
                    <div className="h-full w-full flex-grow overflow-scroll">
                        <iframe
                            key={src}
                            src={src}
                            allow="camera *; microphone *; fullscreen *"
                            style={{ width: '100%', height: '85%', border: 'none' }}
                            className="rounded-md"
                            sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals allow-top-navigation-by-user-activation allow-media-devices"
                        />
                        <div className="flex h-[15%] w-full flex-col items-center justify-center gap-2 px-5">
                            <Button
                                variant={'transparent'}
                                className={`h-8 max-w-md font-normal underline`}
                                onClick={() => {
                                    setModalVariant('stop-verification')
                                    setIsHelpModalOpen(true)
                                }}
                                shadowType="primary"
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
                                <Icon name="peanut-support" size={16} className="text-grey-1" />
                                <p className="text-xs font-medium text-grey-1 underline">Having trouble?</p>
                            </button>
                        </div>
                    </div>
                </div>
            )}
            <ActionModal
                visible={isHelpModalOpen}
                onClose={() => setIsHelpModalOpen(false)}
                title={modalDetails.title}
                description={modalDetails.description}
                icon={modalDetails.icon}
                iconContainerClassName={modalDetails.iconContainerClassName}
                modalPanelClassName="max-w-full pointer-events-auto"
                ctaClassName="grid grid-cols-1 gap-3"
                contentContainerClassName="px-6 py-6"
                modalClassName="!z-[10001] pointer-events-auto"
                preventClose={true}
                ctas={modalDetails.ctas}
            />
        </Modal>
    )
}

export default IframeWrapper
