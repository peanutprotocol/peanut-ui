'use client'

import { useEffect, useMemo, useState, useRef, useCallback } from 'react'
import Modal from '@/components/Global/Modal'
import ActionModal from '@/components/Global/ActionModal'
import { Icon, type IconName } from '@/components/Global/Icons/Icon'
import { Button, type ButtonVariant } from '@/components/0_Bruddle/Button'
import { useModalsContext } from '@/context/ModalsContext'
import StartVerificationView from '../Global/IframeWrapper/StartVerificationView'

// todo: move to consts
const SUMSUB_SDK_URL = 'https://static.sumsub.com/idensic/static/sns-websdk-builder.js'

interface SumsubKycWrapperProps {
    visible: boolean
    accessToken: string | null
    onClose: () => void
    onComplete: () => void
    onError?: (error: unknown) => void
    onRefreshToken: () => Promise<string>
}

export const SumsubKycWrapper = ({
    visible,
    accessToken,
    onClose,
    onComplete,
    onError,
    onRefreshToken,
}: SumsubKycWrapperProps) => {
    const [isVerificationStarted, setIsVerificationStarted] = useState(false)
    const [sdkLoaded, setSdkLoaded] = useState(false)
    const [sdkLoadError, setSdkLoadError] = useState(false)
    const [isHelpModalOpen, setIsHelpModalOpen] = useState(false)
    const [modalVariant, setModalVariant] = useState<'stop-verification' | 'trouble'>('trouble')
    const sdkContainerRef = useRef<HTMLDivElement>(null)
    const sdkInstanceRef = useRef<SnsWebSdkInstance | null>(null)
    const { setIsSupportModalOpen } = useModalsContext()

    // callback refs to avoid stale closures in sdk init effect
    const onCompleteRef = useRef(onComplete)
    const onErrorRef = useRef(onError)
    const onRefreshTokenRef = useRef(onRefreshToken)

    useEffect(() => {
        onCompleteRef.current = onComplete
        onErrorRef.current = onError
        onRefreshTokenRef.current = onRefreshToken
    }, [onComplete, onError, onRefreshToken])

    // stable wrappers that read from refs
    const stableOnComplete = useCallback(() => onCompleteRef.current(), [])
    const stableOnError = useCallback((error: unknown) => onErrorRef.current?.(error), [])
    const stableOnRefreshToken = useCallback(() => onRefreshTokenRef.current(), [])

    // load sumsub websdk script
    useEffect(() => {
        const existingScript = document.getElementById('sumsub-websdk')
        if (existingScript) {
            setSdkLoaded(true)
            return
        }

        const script = document.createElement('script')
        script.id = 'sumsub-websdk'
        script.src = SUMSUB_SDK_URL
        script.async = true
        script.onload = () => setSdkLoaded(true)
        script.onerror = () => {
            console.error('[sumsub] failed to load websdk script')
            setSdkLoadError(true)
        }
        document.head.appendChild(script)
    }, [])

    // initialize sdk when verification starts and all deps are ready
    useEffect(() => {
        if (!isVerificationStarted || !accessToken || !sdkLoaded || !sdkContainerRef.current) return

        // clean up previous instance
        if (sdkInstanceRef.current) {
            try {
                sdkInstanceRef.current.destroy()
            } catch {
                // ignore cleanup errors
            }
        }

        try {
            const sdk = window.snsWebSdk
                .init(accessToken, stableOnRefreshToken)
                .withConf({ lang: 'en', theme: 'light' })
                .withOptions({ addViewportTag: false, adaptIframeHeight: true })
                .on('onApplicantSubmitted', () => stableOnComplete())
                .on('onApplicantResubmitted', () => stableOnComplete())
                .on(
                    'onApplicantStatusChanged',
                    (payload: { reviewStatus?: string; reviewResult?: { reviewAnswer?: string } }) => {
                        // auto-close when sumsub shows success screen
                        if (payload?.reviewStatus === 'completed' && payload?.reviewResult?.reviewAnswer === 'GREEN') {
                            stableOnComplete()
                        }
                    }
                )
                .on('onError', (error: unknown) => {
                    console.error('[sumsub] sdk error', error)
                    stableOnError(error)
                })
                .build()

            sdk.launch(sdkContainerRef.current)
            sdkInstanceRef.current = sdk
        } catch (error) {
            console.error('[sumsub] failed to initialize sdk', error)
            stableOnError(error)
        }

        return () => {
            if (sdkInstanceRef.current) {
                try {
                    sdkInstanceRef.current.destroy()
                } catch {
                    // ignore cleanup errors
                }
                sdkInstanceRef.current = null
            }
        }
    }, [isVerificationStarted, accessToken, sdkLoaded, stableOnComplete, stableOnError, stableOnRefreshToken])

    // reset state when modal closes
    useEffect(() => {
        if (!visible) {
            setIsVerificationStarted(false)
            setSdkLoadError(false)
            if (sdkInstanceRef.current) {
                try {
                    sdkInstanceRef.current.destroy()
                } catch {
                    // ignore cleanup errors
                }
                sdkInstanceRef.current = null
            }
        }
    }, [visible])

    const modalDetails = useMemo(() => {
        if (modalVariant === 'trouble') {
            return {
                title: 'Having trouble verifying?',
                description:
                    "If the verification isn't loading or working properly, please contact our support team for help.",
                icon: 'question-mark' as IconName,
                iconContainerClassName: 'bg-primary-1',
                ctas: [
                    {
                        text: 'Chat with support',
                        icon: 'peanut-support' as IconName,
                        onClick: () => setIsSupportModalOpen(true),
                        variant: 'purple' as ButtonVariant,
                        shadowSize: '4' as const,
                    },
                ],
            }
        }

        return {
            title: 'Stop verification?',
            description: "If you exit now, your verification won't be completed and you'll need to start again later.",
            icon: 'alert' as IconName,
            iconContainerClassName: 'bg-secondary-1',
            ctas: [
                {
                    text: 'Stop verification',
                    onClick: () => {
                        setIsHelpModalOpen(false)
                        onClose()
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
    }, [modalVariant, onClose, setIsSupportModalOpen])

    return (
        <Modal
            visible={visible}
            onClose={onClose}
            classWrap="h-full w-full !max-w-none sm:!max-w-[600px] border-none sm:m-auto m-0"
            classOverlay={`bg-black bg-opacity-50 ${isHelpModalOpen ? 'pointer-events-none' : ''}`}
            video={false}
            className={`z-[100] !p-0 md:!p-6 ${isHelpModalOpen ? 'pointer-events-none' : ''}`}
            classButtonClose="hidden"
            preventClose={true}
            hideOverlay={false}
        >
            {!isVerificationStarted ? (
                // start verification view (provider-agnostic, not reusing StartVerificationView which references "Persona")
                <StartVerificationView onClose={onClose} onStartVerification={() => setIsVerificationStarted(true)} />
            ) : sdkLoadError ? (
                // script failed to load — show user-facing error
                <div className="flex h-full flex-col items-center justify-center gap-4 p-8">
                    <Icon name="alert" className="text-red-500 h-12 w-12" />
                    <p className="text-center text-lg font-medium">
                        Failed to load verification. Please check your connection and try again.
                    </p>
                    <Button variant="purple" shadowSize="4" onClick={onClose}>
                        Close
                    </Button>
                </div>
            ) : (
                // SDK container + controls
                <div className="flex h-full flex-col gap-2 p-0">
                    <div className="relative h-full w-full flex-grow">
                        <div ref={sdkContainerRef} className="w-full overflow-auto p-4" style={{ height: '85%' }} />
                        <div className="absolute bottom-0 flex h-[12%] w-full flex-col items-center justify-center gap-2 px-5 shadow-md">
                            <Button
                                variant="transparent"
                                className="h-8 max-w-md font-normal underline"
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
