'use client'

import { useEffect, useMemo, useState, useRef, useCallback } from 'react'
import Modal from '@/components/Global/Modal'
import ActionModal from '@/components/Global/ActionModal'
import { Icon, type IconName } from '@/components/Global/Icons/Icon'
import { Button, type ButtonVariant } from '@/components/0_Bruddle/Button'
import Loading from '@/components/Global/Loading'
import { useModalsContext } from '@/context/ModalsContext'
import { evaluateSumsubStatusEvent, type SumsubStatusEventPayload } from './sumsubStatusEvent.utils'

// todo: move to consts
const SUMSUB_SDK_URL = 'https://static.sumsub.com/idensic/static/sns-websdk-builder.js'

interface SumsubKycWrapperProps {
    visible: boolean
    accessToken: string | null
    onClose: () => void
    onComplete: () => void
    onError?: (error: unknown) => void
    onRefreshToken: () => Promise<string>
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
    isMultiLevel,
}: SumsubKycWrapperProps) => {
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
        if (window.snsWebSdk) {
            setSdkLoaded(true)
            return undefined
        }

        const handleLoaded = () => setSdkLoaded(true)
        const handleError = () => {
            console.error('[sumsub] failed to load websdk script')
            setSdkLoadError(true)
        }

        const existingScript = document.getElementById('sumsub-websdk')
        if (existingScript) {
            // another wrapper instance appended the script and it's still
            // downloading — a bare existence check would init against an
            // undefined window.snsWebSdk
            existingScript.addEventListener('load', handleLoaded)
            existingScript.addEventListener('error', handleError)
            // the script may have finished between the snsWebSdk check above
            // and the listener attach — re-check so we don't wait forever
            if (window.snsWebSdk) handleLoaded()
            return () => {
                existingScript.removeEventListener('load', handleLoaded)
                existingScript.removeEventListener('error', handleError)
            }
        }

        const script = document.createElement('script')
        script.id = 'sumsub-websdk'
        script.src = SUMSUB_SDK_URL
        script.async = true
        script.onload = handleLoaded
        script.onerror = handleError
        document.head.appendChild(script)
        return undefined
    }, [])

    // initialize sdk as soon as the modal is visible and all deps are ready
    useEffect(() => {
        if (!visible || !accessToken || !sdkLoaded || !sdkContainerRef.current) return

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
            // RED stays open so the user can resubmit; the resubmission path
            // emits onApplicantActionSubmitted, which handleActionSubmitted
            // closes. See evaluateSumsubStatusEvent for the early-guard rules.
            const handleStatusEvent = (eventName: string) => (payload: SumsubStatusEventPayload) => {
                console.log(`[sumsub] ${eventName} fired`, payload)
                const evaluation = evaluateSumsubStatusEvent({
                    payload,
                    sdkInitTime,
                    now: Date.now(),
                    isMultiLevel: !!isMultiLevelRef.current,
                })
                if (evaluation.markSubmitted) hasSubmittedRef.current = true
                if (evaluation.autoClose) stableOnComplete()
            }
            const handleStatusChanged = handleStatusEvent('onApplicantStatusChanged')
            const handleActionCompleted = handleStatusEvent('onApplicantActionStatusChanged')

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
            // surface the error UI — without this the modal stays blank
            setSdkLoadError(true)
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
    }, [visible, accessToken, sdkLoaded, stableOnComplete, stableOnError, stableOnRefreshToken])

    // reset state when modal closes (the init effect's cleanup already
    // destroys the SDK instance — visible is one of its deps)
    useEffect(() => {
        if (!visible) {
            setSdkLoadError(false)
            hasSubmittedRef.current = false
        }
    }, [visible])

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
                title: 'Need a hand?',
                description: "If the ID check isn't loading or working properly, our support team will help.",
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

        return {
            title: 'Exit for now?',
            description: 'You can pick up where you left off later — your progress is saved.',
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
    }, [modalVariant, onClose, setIsSupportModalOpen])

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
                {sdkLoadError ? (
                    <div className="flex h-full flex-col items-center justify-center gap-4 p-8">
                        <Icon name="alert" size={24} className="text-red-500" />
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
                        <div className="relative w-full flex-1">
                            {/* sits behind the SDK iframe — covered once it paints */}
                            <div className="absolute inset-0 flex items-center justify-center">
                                <Loading className="h-8 w-8" />
                            </div>
                            <div
                                ref={sdkContainerRef}
                                className="relative h-full w-full overflow-auto [&>iframe]:!min-h-full"
                            />
                        </div>
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
