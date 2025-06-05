'use client'

import PeanutLoading from '@/components/Global/PeanutLoading'
import { SetupWrapper } from '@/components/Setup/components/SetupWrapper'
import { BeforeInstallPromptEvent, ScreenId, ISetupStep } from '@/components/Setup/Setup.types'
import { useSetupFlow } from '@/hooks/useSetupFlow'
import { useAppDispatch, useSetupStore } from '@/redux/hooks'
import { setupActions } from '@/redux/slices/setup-slice'
import { useEffect, useState } from 'react'
import ActionModal from '@/components/Global/ActionModal'
import { IconName } from '@/components/Global/Icons/Icon'
import { setupSteps as masterSetupSteps } from '../../../components/Setup/Setup.consts'
import UnsupportedBrowserModal from '@/components/Global/UnsupportedBrowserModal'
import { isLikelyWebview, isDeviceOsSupported, getDeviceTypeForLogic } from '@/components/Setup/Setup.utils'

export default function SetupPage() {
    const { steps } = useSetupStore()
    const { step, handleNext, handleBack } = useSetupFlow()
    const [direction, setDirection] = useState(0)
    const [currentStepIndex, setCurrentStepIndex] = useState(0)
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
    const [canInstall, setCanInstall] = useState(false)
    const [deviceType, setDeviceType] = useState<'ios' | 'android' | 'desktop'>('desktop')
    const dispatch = useAppDispatch()
    const [isLoading, setIsLoading] = useState(true)
    const [showDeviceNotSupportedModal, setShowDeviceNotSupportedModal] = useState(false)
    const [showBrowserNotSupportedModal, setShowBrowserNotSupportedModal] = useState(false)

    useEffect(() => {
        setIsLoading(true)

        const determineInitialStep = async () => {
            if (!steps || steps.length === 0) {
                console.warn('determineInitialStep: Redux steps not yet loaded. Will retry when steps update.')
                setIsLoading(false) // prevent infinite loading if steps never arrive
                return
            }
            await new Promise((resolve) => setTimeout(resolve, 100)) // ensure other initializations can complete

            // check for native passkey support
            let passkeySupport = true
            try {
                passkeySupport = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
            } catch (e) {
                passkeySupport = false
                console.error('Error checking passkey support:', e)
            }

            const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
            const localDeviceType = getDeviceTypeForLogic(ua)
            const osSupportedByVersion = isDeviceOsSupported(ua)
            const webviewByUASignature = isLikelyWebview() // initial webview check based on ua signatures

            // webview detection: if it's an ios device, looks like safari, lacks passkey support,
            // and wasn't caught by signatures, it's likely a restricted webview (e.g., telegram)
            let effectiveCurrentlyInWebview = webviewByUASignature
            if (localDeviceType === 'ios' && /Safari/.test(ua) && !passkeySupport && !webviewByUASignature) {
                effectiveCurrentlyInWebview = true
                console.warn(
                    'INFO: Detected likely iOS webview (Safari-like UA, no passkey support, not caught by signatures).'
                )
            }

            const unsupportedBrowserStepExists = masterSetupSteps.find(
                (s: ISetupStep) => s.screenId === 'unsupported-browser'
            )
            let determinedSetupInitialStepId: ScreenId | undefined = undefined

            // main decision logic for showing modals or proceeding with setup
            if (effectiveCurrentlyInWebview) {
                // if in a webview and passkeys aren't supported (and the unsupported browser step is defined),
                // show the unsupported browser modal
                if (!passkeySupport && unsupportedBrowserStepExists) {
                    setShowBrowserNotSupportedModal(true)
                    setIsLoading(false)
                    setDeviceType(localDeviceType)
                    return
                }
            } else {
                // not in an effective webview
                if (!osSupportedByVersion) {
                    // if os version is too old, show device not supported modal
                    setShowDeviceNotSupportedModal(true)
                    setIsLoading(false)
                    setDeviceType(localDeviceType)
                    return
                } else if (!passkeySupport) {
                    // if os is fine but passkeys are still not supported (e.g., old browser on supported os),
                    // show device not supported modal
                    setShowDeviceNotSupportedModal(true)
                    setIsLoading(false)
                    setDeviceType(localDeviceType)
                    return
                }
            }

            // if no modal was triggered, proceed to determine actual setup step
            setDeviceType(localDeviceType)

            const isStandalonePWA =
                typeof window !== 'undefined' && window.matchMedia('(display-mode: standalone)').matches

            if (localDeviceType === 'android' && !isStandalonePWA) {
                setCanInstall(true)
                setDeferredPrompt({} as BeforeInstallPromptEvent)
            }

            if (localDeviceType === 'android') {
                determinedSetupInitialStepId = isStandalonePWA ? 'welcome' : 'android-initial-pwa-install'
            } else if (localDeviceType === 'ios') {
                determinedSetupInitialStepId = 'welcome'
            } else {
                determinedSetupInitialStepId = 'pwa-install'
            }

            if (determinedSetupInitialStepId) {
                const initialStepIndex = steps.findIndex((s: ISetupStep) => s.screenId === determinedSetupInitialStepId)
                if (initialStepIndex !== -1) {
                    dispatch(setupActions.setStep(initialStepIndex + 1))
                } else {
                    console.warn(
                        `Could not find step index for screenId: ${determinedSetupInitialStepId}. Defaulting to step 1.`
                    )
                    dispatch(setupActions.setStep(1))
                }
            } else {
                console.warn('No specific initial step ID determined. Defaulting to step 1.')
                dispatch(setupActions.setStep(1))
            }

            setIsLoading(false)
        }

        determineInitialStep()

        const handleBeforeInstallPrompt = (e: Event) => {
            e.preventDefault()
            setDeferredPrompt(e as BeforeInstallPromptEvent)
            setCanInstall(true)
        }
        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
        }
    }, [dispatch, steps])

    useEffect(() => {
        if (step) {
            const newIndex = steps.findIndex((s: ISetupStep) => s.screenId === step.screenId)
            setDirection(newIndex > currentStepIndex ? 1 : -1)
            setCurrentStepIndex(newIndex)
        }
    }, [step, currentStepIndex, steps])

    if (isLoading)
        return (
            <div className="flex h-[100dvh] w-full flex-col items-center justify-center">
                <PeanutLoading />
            </div>
        )

    // if no step is determined and no blocking modal is shown, it's an issue
    if (!step && !showDeviceNotSupportedModal && !showBrowserNotSupportedModal) {
        console.warn('SetupPage: No current step found, and no blocking modal. Possibly init issue.')
        return (
            <div className="flex h-[100dvh] w-full flex-col items-center justify-center">
                <PeanutLoading />
            </div>
        )
    }

    if (showDeviceNotSupportedModal) {
        return (
            <ActionModal
                visible={true}
                onClose={() => {}} // no action on close for this modal
                title="Device not supported!"
                description="This device doesn't support some of the technologies Peanut needs to work properly. Please try opening this link on a newer phone."
                icon={'alert' as IconName}
                preventClose={true}
                hideModalCloseButton={true}
                ctas={[]}
            />
        )
    }

    if (showBrowserNotSupportedModal) {
        return <UnsupportedBrowserModal visible={true} allowClose={false} />
    }

    // fallback if step is still null after modal checks, though unlikely
    if (!step) {
        console.warn('SetupPage: No current step after modal checks.')
        return (
            <div className="flex h-[100dvh] w-full flex-col items-center justify-center">
                <PeanutLoading />
            </div>
        )
    }

    return (
        <SetupWrapper
            layoutType={step.layoutType}
            screenId={step.screenId}
            image={step.image}
            title={step.title}
            description={step.description}
            showBackButton={step.showBackButton}
            showSkipButton={step.showSkipButton}
            imageClassName={step.imageClassName}
            onBack={handleBack}
            onSkip={() => handleNext()}
            step={currentStepIndex}
            direction={direction}
            deferredPrompt={deferredPrompt}
            canInstall={canInstall}
            deviceType={deviceType}
            titleClassName={step.titleClassName}
            contentClassName={step.contentClassName}
        >
            <step.component />
        </SetupWrapper>
    )
}
