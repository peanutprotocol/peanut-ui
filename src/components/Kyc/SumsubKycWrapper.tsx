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
    /** skip StartVerificationView and launch SDK immediately (for re-submissions) */
    autoStart?: boolean
    /** multi-level workflow (e.g. LATAM) — don't close SDK on Level 1 submission */
    isMultiLevel?: boolean
}

export const SumsubKycWrapper = ({
    visible,
    accessToken,
    onClose,
    onComplete,
    onError,
    onRefreshToken,
    autoStart,
    isMultiLevel,
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
    const isMultiLevelRef = useRef(isMultiLevel)
    // flips to true as soon as any "the user finished something" event fires.
    // Drives the close-confirmation short-circuit: if the user has already
    // submitted, tapping X closes the modal without asking "stop verification?"
    const hasSubmittedRef = useRef(false)

    useEffect(() => {
        onCompleteRef.current = onComplete
        onErrorRef.current = onError
        onRefreshTokenRef.current = onRefreshToken
        isMultiLevelRef.current = isMultiLevel
    }, [onComplete, onError, onRefreshToken, isMultiLevel])

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

        // declared outside try so cleanup can access it
        let iframeObserver: MutationObserver | null = null

        try {
            // track sdk init time so we can ignore stale onApplicantStatusChanged events
            // that fire immediately when the applicant is already approved (e.g. additional-docs flow)
            const sdkInitTime = Date.now()

            const handleSubmitted = () => {
                console.log('[sumsub] onApplicantSubmitted fired')
                hasSubmittedRef.current = true
                // for multi-level workflows (LATAM), the SDK transitions to Level 2
                // internally. don't close the modal on Level 1 submission.
                if (isMultiLevelRef.current) return
                stableOnComplete()
            }
            // resubmission = user retried after rejection (ACTION_REQUIRED).
            // always close SDK regardless of multi-level — the retry is a fresh submission.
            const handleResubmitted = () => {
                console.log('[sumsub] onApplicantResubmitted fired')
                hasSubmittedRef.current = true
                stableOnComplete()
            }
            // Applicant Actions (like rain-card-application) emit this instead
            // of onApplicantSubmitted. Without the listener we'd miss the
            // signal and the close button would keep warning about
            // abandonment after a successful action submission.
            const handleActionSubmitted = () => {
                console.log('[sumsub] action submitted fired')
                hasSubmittedRef.current = true
                if (isMultiLevelRef.current) return
                stableOnComplete()
            }
            const handleStatusChanged = (payload: {
                reviewStatus?: string
                reviewResult?: { reviewAnswer?: string }
            }) => {
                console.log('[sumsub] onApplicantStatusChanged fired', payload)
                // ignore status events that fire within 3s of sdk init — these reflect
                // pre-existing state (e.g. user already approved), not a new submission
                if (Date.now() - sdkInitTime < 3000) {
                    console.log('[sumsub] ignoring early onApplicantStatusChanged (pre-existing state)')
                    return
                }
                // for multi-level workflows (LATAM), Level 1 fires completed+GREEN
                // before Level 2 is shown. don't close the SDK.
                if (isMultiLevelRef.current) return
                // auto-close when sumsub shows success screen
                if (payload?.reviewStatus === 'completed' && payload?.reviewResult?.reviewAnswer === 'GREEN') {
                    hasSubmittedRef.current = true
                    stableOnComplete()
                }
            }

            // for applicant actions, the SDK fires action-specific events.
            // only close on terminal status to avoid premature SDK closure.
            const handleActionCompleted = (payload: {
                reviewStatus?: string
                reviewResult?: { reviewAnswer?: string }
            }) => {
                console.log('[sumsub] onApplicantActionStatusChanged fired', payload)
                if (payload?.reviewStatus === 'completed') {
                    stableOnComplete()
                }
            }

            const sdk = window.snsWebSdk
                .init(accessToken, stableOnRefreshToken)
                .withConf({ lang: 'en', theme: 'light' })
                .withOptions({ addViewportTag: false, adaptIframeHeight: true })
                .on('onApplicantSubmitted', handleSubmitted)
                .on('onApplicantResubmitted', handleResubmitted)
                .on('onApplicantStatusChanged', handleStatusChanged)
                // Applicant Action events (card-application, additional-docs, etc.)
                .on('onActionSubmitted', handleActionSubmitted)
                .on('onApplicantActionSubmitted', handleActionSubmitted)
                .on('onApplicantActionStatusChanged', handleActionCompleted)
                // also listen for idCheck-prefixed events (some sdk versions use these)
                .on('idCheck.onApplicantSubmitted', handleSubmitted)
                .on('idCheck.onApplicantResubmitted', handleResubmitted)
                .on('idCheck.onApplicantStatusChanged', handleStatusChanged)
                .on('idCheck.onActionSubmitted', handleActionSubmitted)
                .on('idCheck.onApplicantActionSubmitted', handleActionSubmitted)
                .on('idCheck.onApplicantActionStatusChanged', handleActionCompleted)
                .on('onError', (error: unknown) => {
                    console.error('[sumsub] sdk error', error)
                    stableOnError(error)
                })
                .build()

            sdk.launch(sdkContainerRef.current)
            sdkInstanceRef.current = sdk

            // ensure the sdk-created iframe gets camera/microphone permissions.
            // some sdk versions don't set the allow attribute, which blocks
            // media device access in cross-origin iframes.
            iframeObserver = new MutationObserver((mutations) => {
                for (const mutation of mutations) {
                    for (const node of mutation.addedNodes) {
                        if (node instanceof HTMLIFrameElement && !node.allow?.includes('camera')) {
                            node.allow = 'camera; microphone; fullscreen'
                        }
                    }
                }
            })
            iframeObserver.observe(sdkContainerRef.current, { childList: true })

            // also patch any iframe that was added before the observer
            const existingIframe = sdkContainerRef.current.querySelector('iframe')
            if (existingIframe && !existingIframe.allow?.includes('camera')) {
                existingIframe.allow = 'camera; microphone; fullscreen'
            }
        } catch (error) {
            console.error('[sumsub] failed to initialize sdk', error)
            stableOnError(error)
        }

        return () => {
            iframeObserver?.disconnect()
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

    // reset state when modal closes, auto-start on re-submission
    useEffect(() => {
        if (!visible) {
            setIsVerificationStarted(false)
            setSdkLoadError(false)
            hasSubmittedRef.current = false
            if (sdkInstanceRef.current) {
                try {
                    sdkInstanceRef.current.destroy()
                } catch {
                    // ignore cleanup errors
                }
                sdkInstanceRef.current = null
            }
        } else if (autoStart) {
            // skip StartVerificationView on re-submission (user already consented)
            setIsVerificationStarted(true)
        }
    }, [visible, autoStart])

    // Close-button handler. After the user has submitted, the "are you sure
    // you want to stop?" modal is misleading — they're done, not abandoning.
    // Skip straight to onClose in that case.
    const handleCloseButton = useCallback(() => {
        if (hasSubmittedRef.current) {
            onClose()
            return
        }
        setModalVariant('stop-verification')
        setIsHelpModalOpen(true)
    }, [onClose])

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
                        onClick: () => setIsSupportModalOpen(true),
                        variant: 'purple' as ButtonVariant,
                        shadowSize: '4' as const,
                    },
                    {
                        text: 'Cancel',
                        onClick: () => setIsHelpModalOpen(false),
                        variant: 'transparent' as ButtonVariant,
                        className: 'underline text-sm font-medium w-full h-fit mt-3',
                    },
                ],
            }
        }

        return autoStart
            ? {
                  title: 'Are you sure you want to exit?',
                  description:
                      "You are about to exit verification, you can come back to finish this later. Your progress won't be lost.",
                  icon: 'alert' as IconName,
                  iconContainerClassName: 'bg-secondary-1',
                  ctas: [
                      {
                          text: 'Exit',
                          onClick: () => {
                              setIsHelpModalOpen(false)
                              onClose()
                          },
                          variant: 'purple' as ButtonVariant,
                          shadowSize: '4' as const,
                      },
                      {
                          text: 'Continue',
                          onClick: () => setIsHelpModalOpen(false),
                          variant: 'transparent' as ButtonVariant,
                          className: 'underline text-sm font-medium w-full h-fit mt-3',
                      },
                  ],
              }
            : {
                  title: 'Stop verification?',
                  description:
                      "If you exit now, your verification won't be completed and you'll need to start again later.",
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
    }, [autoStart, modalVariant, onClose, setIsSupportModalOpen])

    return (
        <>
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
                    <StartVerificationView
                        onClose={onClose}
                        onStartVerification={() => setIsVerificationStarted(true)}
                    />
                ) : sdkLoadError ? (
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
                    <div className="flex h-full flex-col">
                        <div className="flex items-center justify-between px-4 py-2">
                            <button
                                onClick={() => {
                                    setModalVariant('trouble')
                                    setIsHelpModalOpen(true)
                                }}
                                className="flex items-center gap-1 p-1"
                            >
                                <Icon name="peanut-support" size={20} className="text-grey-1" />
                            </button>
                            <button onClick={handleCloseButton} className="p-1">
                                <Icon name="cancel" size={24} />
                            </button>
                        </div>
                        <div ref={sdkContainerRef} className="w-full flex-1 overflow-auto [&>iframe]:!min-h-full" />
                    </div>
                )}
            </Modal>
            {/* rendered outside the outer Modal to avoid pointer-events-none blocking clicks */}
            <ActionModal
                visible={isHelpModalOpen}
                onClose={() => setIsHelpModalOpen(false)}
                title={modalDetails.title}
                description={modalDetails.description}
                icon={modalDetails.icon}
                iconContainerClassName={modalDetails.iconContainerClassName}
                modalPanelClassName="max-w-full"
                ctaClassName="grid grid-cols-1 gap-3"
                contentContainerClassName="px-6 py-6"
                modalClassName="!z-[10001]"
                preventClose={true}
                ctas={modalDetails.ctas}
            />
        </>
    )
}
